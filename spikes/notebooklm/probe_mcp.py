"""Read-only MCP probe. Emits metadata, never notebook text or credentials."""

import argparse
import asyncio
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sys


def summarize_notebook_result(result: dict) -> dict:
    """Business errors can have isError=false; do not treat that as access."""
    payload = result.get("structuredContent")
    if not isinstance(payload, dict):
        payload = None
        for item in result.get("content") or []:
            if not isinstance(item, dict) or item.get("type") != "text":
                continue
            try:
                value = json.loads(item.get("text", ""))
            except (TypeError, json.JSONDecodeError):
                continue
            if isinstance(value, dict):
                payload = value
                break

    if result.get("isError"):
        return {"notebook_access_verified": False, "reason": "mcp_tool_error"}
    if not isinstance(payload, dict):
        return {"notebook_access_verified": False, "reason": "invalid_response"}
    if payload.get("status") != "success":
        message = str(payload.get("error", "")).lower()
        reason = (
            "authentication_required"
            if any(word in message for word in ("auth", "login", "sign-in", "sign in"))
            else "notebook_request_failed"
        )
        return {"notebook_access_verified": False, "reason": reason}
    notebooks = payload.get("notebooks")
    if not isinstance(notebooks, list):
        return {"notebook_access_verified": False, "reason": "invalid_notebook_list"}
    return {
        "notebook_access_verified": True,
        "returned_notebook_count": len(notebooks),
        "reason": "read_only_list_succeeded",
    }


async def probe(args: argparse.Namespace) -> dict:
    # SDK is imported only for a live probe; unit tests need only stdlib.
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    env = dict(os.environ)
    if args.state_dir:
        env["NOTEBOOKLM_MCP_CLI_PATH"] = str(Path(args.state_dir).resolve())
    if args.profile:
        env["NLM_PROFILE"] = args.profile
    params = StdioServerParameters(command=args.server, env=env)
    # Third-party diagnostics stay out of the public report and chat output.
    with open(os.devnull, "w", encoding="utf8") as errlog:
        async with stdio_client(params, errlog=errlog) as (read, write):
            async with ClientSession(read, write, read_timeout_seconds=30.0) as session:
                info = (await session.initialize()).model_dump(mode="json", by_alias=True)
                catalog = await session.list_tools()
                tool_names = {tool.name for tool in catalog.tools}
                server = info.get("serverInfo", {})
                report = {
                    "observed_at": datetime.now(timezone.utc).isoformat(),
                    "transport_connected": True,
                    "protocol_version": info.get("protocolVersion"),
                    "server_name": server.get("name"),
                    "server_reported_version": server.get("version"),
                    "tool_count": len(tool_names),
                    "read_only_tools": sorted(tool_names & {"notebook_list", "notebook_get"}),
                    "notebook_access_verified": False,
                    "native_chat_tools_hot_loaded": False,
                }
                if "notebook_list" not in tool_names:
                    return {**report, "reason": "notebook_list_not_available"}
                result = await session.call_tool("notebook_list", {"max_results": 1})
                return {
                    **report,
                    **summarize_notebook_result(result.model_dump(mode="json", by_alias=True)),
                }


def main() -> int:
    local_binary = Path(sys.executable).parent / "notebooklm-mcp"
    default_server = shutil.which("notebooklm-mcp")
    if not default_server and local_binary.is_file():
        default_server = str(local_binary)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", default=default_server)
    parser.add_argument("--state-dir")
    parser.add_argument("--profile")
    parser.add_argument("--report", help="Optional path for sanitized metadata JSON")
    args = parser.parse_args()
    if not args.server:
        parser.error("Install requirements-mcp.txt in a private venv, or pass --server")

    try:
        result = asyncio.run(probe(args))
    except Exception as error:
        result = {
            "transport_connected": False,
            "notebook_access_verified": False,
            "reason": "probe_failed",
            "error_type": type(error).__name__,
        }
    output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        Path(args.report).write_text(output, encoding="utf8")
    print(output, end="")
    if result.get("notebook_access_verified"):
        return 0
    return 2 if result.get("transport_connected") else 3


if __name__ == "__main__":
    sys.exit(main())
