export function YouTubeEmbed({ id }: { id: string }) {
  return (
    <div>
      <iframe className="rounded-xl" src={`https://www.youtube.com/embed/${id}`} />
    </div>
  );
}
