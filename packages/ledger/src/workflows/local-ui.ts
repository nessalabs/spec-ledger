import { randomBytes } from "node:crypto";
import { normalizeOperationError } from "../application/errors.js";
import { executeOperation } from "../application/operations.js";
/** Explicit local browser action only. The generic projection server stays GET-only. */
export function createLocalWorkflowBridge(root: string) {
    const token = randomBytes(32).toString("hex");
    const json = (status: number, data: unknown) => Response.json(data && typeof data === "object" && "error" in data && !("code" in data) ? {...data,code:status===403?"permission_denied":"invalid_input"} : data, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
    return async (request: Request): Promise<Response> => {
        const url = new URL(request.url), host = request.headers.get("host") ?? url.host;
        let hostUrl: URL;
        try {
            hostUrl = new URL(`http://${host}`);
        }
        catch {
            return json(403, { error: "Local host required" });
        }
        const loopback = ["localhost", "127.0.0.1", "[::1]"], origin = request.headers.get("origin");
        if (!loopback.includes(hostUrl.hostname) || !loopback.includes(url.hostname) || hostUrl.host !== host || hostUrl.port !== url.port)
            return json(403, { error: "Local host required" });
        if ((origin && origin !== `${url.protocol}//${hostUrl.host}`) || request.headers.get("sec-fetch-site") === "cross-site")
            return json(403, { error: "Same-origin browser action required" });
        try {
            if (request.method === "GET") {
                const workstreamId = url.searchParams.get("workstreamId");
                return json(200, { token, options: executeOperation(root, "get_workflow_options", { workstreamId }) });
            }
            if (request.method !== "POST")
                return json(405, { error: "Unsupported workflow method" });
            if (!origin || request.headers.get("x-spec-ledger-token") !== token || request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
                return json(403, { error: "Same-origin workflow token required" });
            const reader = request.body?.getReader();
            if (!reader)
                return json(400, { error: "Workflow request required" });
            const chunks: Uint8Array[] = [];
            let size = 0;
            while (true) {
                const { value, done } = await reader.read();
                if (done)
                    break;
                size += value.byteLength;
                if (size > 131072) {
                    await reader.cancel();
                    return json(413, { error: "Workflow request too large" });
                }
                chunks.push(value);
            }
            let input: unknown;
            try {
                input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            }
            catch {
                return json(400, { error: "Invalid workflow JSON" });
            }
            const body = input as { action?: string; input?: Record<string, unknown> };
            if (!body || Object.keys(body).some(key => !["action", "input"].includes(key)) || !body.input) return json(400, { error: "Workflow action and input required" });
            if (body.action === "preview") {
                const preview = executeOperation(root, "preview_workflow", body.input);
                const options = executeOperation(root, "get_workflow_options", { workstreamId: body.input.workstreamId });
                return json(200, { preview, options });
            }
            if (body.action !== "apply" || typeof body.input.expectedConfigurationDigest !== "string") return json(400, { error: "Preview the workflow before applying it" });
            return json(200, executeOperation(root, "set_workflow", body.input));
        }
        catch (error) {
            const normalized=normalizeOperationError(error);
            return json(409, { error: normalized.message, code:normalized.code });
        }
    };
}
