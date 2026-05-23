export function onRequestGet({ data }) {
  return new Response(JSON.stringify({ user: data.user || null }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
