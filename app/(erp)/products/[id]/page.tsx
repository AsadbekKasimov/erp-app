export default function Page({ params }: { params: { id: string } }) {
  return (
    <div>
      Product ID: {params.id}
    </div>
  );
}
