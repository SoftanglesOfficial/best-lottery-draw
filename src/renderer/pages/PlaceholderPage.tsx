export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[400px] items-center justify-center">
      <h1 className="text-2xl font-semibold text-gray-700">{title}</h1>
    </div>
  );
}
