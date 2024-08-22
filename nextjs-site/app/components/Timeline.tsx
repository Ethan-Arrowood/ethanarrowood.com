import clsx from "clsx";

interface Event {
  date: string;
  title: string;
  description: string[];
  events?: Event[];
}

function Event({ event }: { event: Event }) {
  return (
    <li className="mb-8 ms-4 last:mb-0">
      <div className="absolute -start-1.5 h-3 w-3 rounded-full border border-emerald-700 bg-emerald-700 md:h-3.5 md:w-3.5"></div>
      <p className="mb-1 text-xs font-normal leading-none text-gray-400 md:text-sm md:leading-none">{event.date}</p>
      <h3 className="text-sm font-semibold text-gray-900 md:text-base">{event.title}</h3>
      {event.description && event.description.length > 0 ? (
        <ol className="min-w-0 list-inside list-disc text-xs font-normal text-gray-500 md:text-sm">
          {event.description.map((line, i) => (
            <li key={`line-${i}`}>{line}</li>
          ))}
        </ol>
      ) : null}
      {event.events && event.events.length > 0 ? <Timeline events={event.events} subTimeline={true} /> : null}
    </li>
  );
}

export function Timeline({ events, subTimeline = false }: { events: Event[]; subTimeline?: boolean }) {
  return (
    <ol className={clsx("relative ms-2 border-s border-emerald-700", subTimeline && "mt-4 border-dashed")}>
      {events.map((event) => (
        <Event key={event.title} event={event} />
      ))}
    </ol>
  );
}
