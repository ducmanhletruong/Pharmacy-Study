import json
import unittest

from probe_mcp import summarize_notebook_result


class NotebookProbeTest(unittest.TestCase):
    def test_business_auth_error_is_not_connection_success(self):
        result = summarize_notebook_result({
            "isError": False,
            "structuredContent": {"status": "error", "error": "No authentication found"},
        })
        self.assertFalse(result["notebook_access_verified"])
        self.assertEqual(result["reason"], "authentication_required")

    def test_empty_authenticated_list_is_valid_without_exposing_data(self):
        result = summarize_notebook_result({
            "structuredContent": {"status": "success", "notebooks": []},
        })
        self.assertTrue(result["notebook_access_verified"])
        self.assertEqual(result["returned_notebook_count"], 0)

    def test_json_text_fallback_and_redacted_output(self):
        result = summarize_notebook_result({
            "content": [{"type": "text", "text": json.dumps({
                "status": "success", "notebooks": [{"title": "PRIVATE", "id": "PRIVATE"}],
            })}],
        })
        self.assertTrue(result["notebook_access_verified"])
        self.assertEqual(result["returned_notebook_count"], 1)
        self.assertNotIn("PRIVATE", json.dumps(result))

    def test_protocol_error_or_malformed_data_is_never_verified(self):
        for raw in [
            {"isError": True, "structuredContent": {"status": "success", "notebooks": []}},
            {"structuredContent": {"status": "success"}},
            {"content": [{"type": "text", "text": "not JSON"}]},
        ]:
            with self.subTest(raw=raw):
                self.assertFalse(summarize_notebook_result(raw)["notebook_access_verified"])


if __name__ == "__main__":
    unittest.main()
