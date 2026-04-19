export async function readSupabaseFunctionErrorMessage(
    error: unknown,
    fallback: string
): Promise<string> {
    if (error && typeof error === 'object') {
        const directMessage = (error as { message?: unknown }).message;
        const context = (error as { context?: unknown }).context as
            | { clone?: () => { json?: () => Promise<unknown>; text?: () => Promise<string> } }
            | undefined;

        if (context && typeof context.clone === 'function') {
            const response = context.clone();

            if (typeof response.json === 'function') {
                try {
                    const payload = (await response.json()) as { error?: unknown; message?: unknown };
                    if (typeof payload?.error === 'string' && payload.error.trim()) {
                        return payload.error.trim();
                    }
                    if (typeof payload?.message === 'string' && payload.message.trim()) {
                        return payload.message.trim();
                    }
                } catch {
                    // Ignora falha de parse JSON e tenta texto puro.
                }
            }

            if (typeof response.text === 'function') {
                try {
                    const text = await response.text();
                    if (text?.trim()) {
                        return text.trim();
                    }
                } catch {
                    // Ignora falha de parse de texto e usa fallback.
                }
            }
        }

        if (typeof directMessage === 'string' && directMessage.trim()) {
            return directMessage.trim();
        }
    }

    return fallback;
}
