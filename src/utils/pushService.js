export async function sendExpoPush(tokens = [], { title, body, data = {} }) {
  const validTokens = [...new Set(tokens)].filter(
    (t) => typeof t === 'string' && t.startsWith('ExponentPushToken[')
  );

  if (validTokens.length === 0) return;

  const messages = validTokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('Error enviando Expo Push:', err.message);
  }
}