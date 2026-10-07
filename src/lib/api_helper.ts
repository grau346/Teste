export async function safeFetchJson<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    let errorMessage = `Erro HTTP ${res.status}`;
    if (text.startsWith("<") || text.includes("<!doctype") || text.includes("<!DOCTYPE")) {
      errorMessage = `Servidor retornou erro (${res.status}). Tente novamente em alguns instantes.`;
    } else {
      try {
        const json = JSON.parse(text);
        if (json.error) errorMessage = json.error;
        else if (json.message) errorMessage = json.message;
      } catch {
        if (text) errorMessage = text.slice(0, 150);
      }
    }
    throw new Error(errorMessage);
  }

  if (text.startsWith("<") || text.includes("<!doctype") || text.includes("<!DOCTYPE")) {
    throw new Error("Resposta inválida do servidor (HTML recebido em vez de JSON).");
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error("Falha ao processar resposta JSON do servidor.");
  }
}
