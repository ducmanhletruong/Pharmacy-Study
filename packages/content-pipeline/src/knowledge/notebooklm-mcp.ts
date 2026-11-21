import { validateSources, type KnowledgeSource } from './index'
// The host owns MCP authentication/transport. Never read or reuse browser tokens.
export type ReadOnlyMcp = (request: {
  name: 'notebook_query'
  arguments: { notebook_id: string; query: string; new_conversation: true }
}) => Promise<unknown>
export class NotebookMcpSource implements KnowledgeSource {
  constructor(
    private call: ReadOnlyMcp,
    private notebookId: string,
    private query: string,
    private extract: (result: unknown) => unknown,
  ) {}
  async read() {
    if (
      !/^[a-f0-9-]{36}$/i.test(this.notebookId) ||
      !this.query.trim() ||
      this.query.length > 4000
    )
      throw Error('Invalid NotebookLM request')
    const result = await this.call({
      name: 'notebook_query',
      arguments: {
        notebook_id: this.notebookId,
        query: this.query,
        new_conversation: true,
      },
    })
    // Tool envelopes vary by server version. The host must extract grounded
    // passages/citations; an answer string alone is never accepted as a source.
    return validateSources(this.extract(result))
  }
}
