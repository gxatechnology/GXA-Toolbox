import { useEffect, useState, type FormEvent } from 'react';

interface Aggregate { average: number | null; count: number; }
interface ToolRatingProps { active: boolean; }

export function ToolRating({ active }: ToolRatingProps) {
  const [available, setAvailable] = useState(false);
  const [aggregate, setAggregate] = useState<Aggregate>({ average: null, count: 0 });
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    fetch('/api/tool-ratings?toolId=background-remover', { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async response => ({ ok: response.ok, body: await response.json() }))
      .then(({ ok, body }) => { if (ok && body.available) { setAggregate(body.aggregate); setAvailable(true); } })
      .catch(() => undefined);
    return () => controller.abort();
  }, [active]);

  if (!active || !available) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating) { setMessage('Choose a star rating first.'); return; }
    setBusy(true); setMessage('Submitting…');
    try {
      const response = await fetch('/api/tool-ratings', {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: 'background-remover', rating, review })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Rating could not be submitted.');
      setAggregate(body.aggregate); setComplete(true); setMessage(body.message || 'Thank you for your feedback!');
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Rating could not be submitted.'); }
    finally { setBusy(false); }
  };
  return <section className="tool-rating-react" aria-label="Rate Background Remover">
    <div><strong>Rate this tool</strong><span>{aggregate.count ? `${Number(aggregate.average).toFixed(1)} / 5 · ${aggregate.count} ${aggregate.count === 1 ? 'rating' : 'ratings'}` : 'Be the first to rate this tool'}</span></div>
    {complete ? <p role="status" className="rating-thanks">{message}</p> : <form onSubmit={submit}>
      <div className="rating-stars" role="radiogroup" aria-label="Rating from 1 to 5 stars">{[1,2,3,4,5].map(value => <button key={value} type="button" role="radio" aria-checked={rating === value} aria-label={`${value} star${value === 1 ? '' : 's'}`} className={rating === value ? 'selected' : ''} onClick={() => setRating(value)}>★</button>)}</div>
      {rating > 0 && <><label><span>Optional review</span><textarea maxLength={1000} rows={3} value={review} onChange={event => setReview(event.target.value)} /></label><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit Rating'}</button></>}
      {message && <p role="status">{message}</p>}
    </form>}
  </section>;
}
