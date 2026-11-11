import { ENDPOINTS } from "@/lib/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-static";

type OpenApiOperation = Record<string, unknown>;

export function GET(): Response {
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const endpoint of ENDPOINTS) {
    const operation: OpenApiOperation = {
      operationId: endpoint.id,
      summary: endpoint.what,
      description: endpoint.what,
      tags: [endpoint.group],
      security: [{ ApiKeyHeader: [] }],
      parameters: endpoint.params.map((param) => ({
        name: param.name,
        in: "query",
        required: false,
        description: param.label,
        schema: param.options
          ? { type: "string", enum: param.options, example: param.example }
          : { type: "string", example: param.example },
      })),
      responses: {
        "200": {
          description: endpoint.returns === "json" ? "Respuesta correcta" : "Archivo o imagen generado",
          content: endpoint.returns === "json"
            ? { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } }, additionalProperties: true } } }
            : { [endpoint.returns === "image" ? "image/webp" : "application/octet-stream"]: { schema: { type: "string", format: "binary" } } },
        },
        "400": { description: "Parámetros o cuerpo no válidos" },
        "401": { description: "Clave API ausente o no válida" },
        "429": { description: "Límite de solicitudes alcanzado" },
        "503": { description: "Proveedor externo no disponible" },
      },
    };

    if (endpoint.body === "file") {
      operation.requestBody = {
        required: true,
        content: {
          "application/octet-stream": {
            schema: { type: "string", format: "binary" },
          },
        },
      };
    }

    const method = endpoint.method.toLowerCase() as "get" | "post";
    paths[endpoint.path] ??= {};
    paths[endpoint.path][method] = operation;
  }

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "YuiAPI",
      version: "1.0.0",
      description: "Especificación generada desde el catálogo real de endpoints de YuiAPI.",
    },
    servers: [{ url: (process.env.NEXT_PUBLIC_SITE_URL || "https://yuiapi.vercel.app").replace(/\/+$/, "") }],
    paths,
    components: {
      securitySchemes: {
        ApiKeyHeader: { type: "apiKey", in: "header", name: "x-api-key" },
        BearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  };

  return Response.json(spec, {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=3600",
      "content-disposition": 'inline; filename="yuiapi-openapi.json"',
    },
  });
}
