export default function DashboardPage() {
  return (
    <div style={{ padding: 30 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
        {[
          { label: "Total Clients", value: "0" },
          { label: "Total Orders", value: "0" },
          { label: "Total Products", value: "0" },
          { label: "Revenue", value: "$0" },
        ].map((card) => (
          <div key={card.label} style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
          }}>
            <div style={{ fontSize: 13, color: "#6B7280" }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}   