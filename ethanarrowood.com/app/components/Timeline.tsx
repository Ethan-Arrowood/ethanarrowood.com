interface Event {
  date: string;
  title: string;
  description: string;
  events?: Event[];
}

function Event ({
  event
}: {
  event: Event
}) {
  return (
    <li className="mb-8 ms-4">
      <div className="absolute w-3 h-3 bg-emerald-700 rounded-full mt-1.5 -start-1.5 border border-emerald-700"></div>
      <p className="mb-1 text-sm font-normal leading-none text-gray-400">{event.date}</p>
      <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
      {
        event.description && event.description.length > 0 ? (
          <ul className="min-w-0 list-inside list-disc text-base font-normal text-gray-500">
            {event.description.split('. ').map((line, i) => <li key={`line-${i}`}>{line}</li>)}
          </ul>
        ) : null
      }
      {
        event.events && event.events.length > 0 ? (
          <Timeline events={event.events} subTimeline={true} />
        ) : null
      }
    </li>
  )
}

export function Timeline ({
 events,
 subTimeline = false,
}: {
  events: Event[],
  subTimeline?: boolean
}) {
  return (
    <ol className={`ms-2 relative border-s border-emerald-700 ${subTimeline ? 'border-dashed mt-4' : ''}`}>
      {
        events.map(event => <Event key={event.title} event={event}/>)
      }
    </ol>
  )
}