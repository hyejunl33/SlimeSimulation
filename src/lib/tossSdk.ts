export async function shareToToss(title: string, text: string): Promise<boolean> {
  // 1. Toss Native Bridge Check (hypothetical Toss App in App environment)
  if (typeof window !== 'undefined' && (window as any).Toss) {
    try {
      await (window as any).Toss.share({
        title,
        text,
        url: window.location.href,
      });
      return true;
    } catch (e) {
      console.warn('Toss share failed, falling back to Web Share API', e);
    }
  }

  // 2. Fallback to native Web Share API (works on most modern mobile browsers)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url: window.location.href,
      });
      return true;
    } catch (e) {
      // User cancelled or failed
      return false;
    }
  }

  // 3. Last fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(window.location.href);
    alert('링크가 클립보드에 복사되었습니다!');
    return true;
  } catch (e) {
    return false;
  }
}
