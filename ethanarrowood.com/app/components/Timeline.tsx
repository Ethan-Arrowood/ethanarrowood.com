interface Event {
  date: string;
  title: string;
  description: string[];
  events?: Event[];
}

function Event({ event, last }: { event: Event; last: boolean }) {
  return (
    <li className={`ms-4 ${last ? "" : "mb-8"}`}>
      <div className="absolute md:w-3.5 md:h-3.5 w-3 h-3 bg-emerald-700 rounded-full -start-1.5 border border-emerald-700"></div>
      <p className="mb-1 md:leading-none md:text-sm text-xs font-normal leading-none text-gray-400">{event.date}</p>
      <h3 className="md:text-base text-sm font-semibold text-gray-900">{event.title}</h3>
      {event.description && event.description.length > 0 ? (
        <ul className="min-w-0 list-inside list-disc md:text-sm text-xs font-normal text-gray-500">
          {event.description.map((line, i) => (
            <li key={`line-${i}`}>{line}</li>
          ))}
        </ul>
      ) : null}
      {event.events && event.events.length > 0 ? <Timeline events={event.events} subTimeline={true} /> : null}
    </li>
  );
}

export function Timeline({ events, subTimeline = false }: { events: Event[]; subTimeline?: boolean }) {
  return (
    <ol className={`ms-2 relative border-s border-emerald-700 ${subTimeline ? "border-dashed mt-4" : ""}`}>
      {events.map((event, i) => (
        <Event key={event.title} event={event} last={i === events.length - 1} />
      ))}
    </ol>
  );
}
