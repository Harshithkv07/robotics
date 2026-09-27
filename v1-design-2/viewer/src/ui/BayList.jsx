import { I } from './icons'

const STATUS = { ok: 'Certified', infeasible: 'Not certified', occupied: 'Occupied' }

// Every bay in the lot, in order. Only certified bays are actions; the others explain themselves on hover.
export default function BayList({ lot, hovered, setHovered, onPick }) {
  const bays = lot.layout.bays
  return (
    <ul className="bays" aria-label="Bays in this lot">
      {bays.map((b) => {
        const ok = b.status === 'ok'
        const hover = { onMouseEnter: () => setHovered(b.id), onMouseLeave: () => setHovered(null) }
        const body = (
          <>
            <span className="bay-n tnum">{String(b.id + 1).padStart(2, '0')}</span>
            <span className="bay-st"><i className={`sw sw-${ok ? 'ok' : b.status === 'occupied' ? 'occ' : 'nc'}`} />{STATUS[b.status]}</span>
            {ok && <span className="bay-sub">{b.approach === 'reverse' ? 'reverse in' : 'drive in forward'}</span>}
            {b.status === 'infeasible' && <span className="bay-sub" title={b.reason}>{(b.reason || '').replace('guidance not certified ', '').replace(/[()]/g, '') || 'failed a check'}</span>}
          </>
        )
        return (
          <li key={b.id} className={`${b.status} ${hovered === b.id ? 'hl' : ''}`}>
            {ok ? (
              <button onClick={() => onPick(b.id)} onFocus={() => setHovered(b.id)} onBlur={() => setHovered(null)} {...hover} title={`Start guided parking into bay ${b.id + 1}`}>
                {body}<span className="bay-go">{I.chevR}</span>
              </button>
            ) : (
              <div {...hover}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
