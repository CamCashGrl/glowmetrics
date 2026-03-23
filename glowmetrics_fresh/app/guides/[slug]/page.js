export default function GuidePage({ params }) {
  const { slug } = params;

  return (
    <div style={{ padding: 40, color: "white", background: "#05070f", minHeight: "100vh" }}>
      <h1>Guide: {slug.replace(/-/g, " ")}</h1>

      <p>
        This is a test SEO page for <strong>{slug}</strong>.
      </p>

      <p>
        If you’re seeing this, your dynamic pages are working correctly.
      </p>
    </div>
  );
}
