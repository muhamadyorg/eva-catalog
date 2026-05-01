const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

async function translateOne(text: string, from: string, to: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return text;
    const json = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number };
    if (json.responseStatus === 200 && json.responseData?.translatedText) {
      return json.responseData.translatedText;
    }
    return text;
  } catch {
    return text;
  }
}

export async function translateFromUz(text: string): Promise<{ ru: string; en: string }> {
  const [ru, en] = await Promise.all([
    translateOne(text, "uz", "ru"),
    translateOne(text, "uz", "en"),
  ]);
  return { ru, en };
}
