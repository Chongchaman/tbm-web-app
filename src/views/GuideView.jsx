import { useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, Search, X } from 'lucide-react';
import { PageHeader, Field, EmptyState } from '../components/PlannerUI';
import { GUIDE_TOPICS, matchingGuideTopics } from '../data/userGuide';

function GuideBlock({ block }) {
  return <section className="guide-block">
    {block.title && <h3>{block.title}</h3>}
    {block.paragraphs?.map(text => <p key={text}>{text}</p>)}
    {block.steps && <ol>{block.steps.map(text => <li key={text}>{text}</li>)}</ol>}
    {block.bullets && <ul>{block.bullets.map(text => <li key={text}>{text}</li>)}</ul>}
    {block.rows && <div className="data-table-wrap" tabIndex={0} role="region" aria-label={block.title || 'ตารางในคู่มือ'}>
      <table className="data-table"><thead><tr>{block.columns.map(text => <th key={text} scope="col">{text}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((text, column) => <td key={column}>{text}</td>)}</tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

export default function GuideView({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState(new Set(['start']));
  const [selected, setSelected] = useState('start');
  const topics = matchingGuideTopics(query);
  const searching = Boolean(query.trim());
  function selectTopic(id) {
    setSelected(id);
    setOpened(previous => new Set([...previous, id]));
    requestAnimationFrame(() => {
      const topic = document.getElementById(`guide-${id}`);
      topic?.scrollIntoView({ block: 'start', behavior: 'instant' });
      topic?.querySelector('summary')?.focus({ preventScroll: true });
    });
  }
  function toggleTopic(id, open) {
    if (searching) return;
    setOpened(previous => {
      if (previous.has(id) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(id); else next.delete(id);
      return next;
    });
  }
  return <div className="stack guide-page">
    <PageHeader eyebrow="คู่มือประจำเว็บ" title="คู่มือการใช้งาน TBM Planner" description="เริ่มจากข้อมูลสนาม วางแผน ตรวจผล และบันทึกข้อมูล — เลือกหัวข้อหรือค้นหาคำที่ต้องการได้เลย" />
    <div className="card guide-search">
      <Search size={22} aria-hidden="true" />
      <Field label="ค้นหาคู่มือ"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น เยื้อง, DTA, บันทึกแผน, Cloud" /></Field>
      {query && <button type="button" className="icon-button" aria-label="ล้างคำค้น" onClick={() => setQuery('')}><X size={18} /></button>}
      <span className="section-note" role="status">{searching ? `พบ ${topics.length} หัวข้อ` : `${GUIDE_TOPICS.length} หัวข้อ ครบทุกโหมด`}</span>
    </div>
    <div className="guide-workspace">
      <nav className="card guide-contents" aria-label="สารบัญคู่มือ">
        <h2><BookOpen size={18} aria-hidden="true" /> สารบัญ</h2>
        {topics.map(topic => <button key={topic.id} type="button" aria-current={selected === topic.id ? 'location' : undefined} onClick={() => selectTopic(topic.id)}>{topic.title}</button>)}
      </nav>
      <div className="stack">
        <div className="guide-mobile-contents"><Field label="เลือกหัวข้อ"><select value={topics.some(topic => topic.id === selected) ? selected : ''} onChange={event => selectTopic(event.target.value)}><option value="" disabled>เลือกหัวข้อที่ต้องการอ่าน</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></Field></div>
        {!topics.length ? <EmptyState title="ไม่พบหัวข้อที่ตรงกับคำค้น" action={<button className="btn btn-secondary" type="button" onClick={() => setQuery('')}>แสดงคู่มือทั้งหมด</button>}>ลองคำสั้น ๆ เช่น “Gap” “เยื้อง” หรือ “บันทึก”</EmptyState> : <>
          {!searching && <div className="page-actions guide-controls"><button className="btn btn-secondary" type="button" onClick={() => setOpened(new Set(topics.map(topic => topic.id)))}>เปิดทุกหัวข้อ</button><button className="btn btn-secondary" type="button" onClick={() => setOpened(new Set())}>ย่อทุกหัวข้อ</button></div>}
          {topics.map(topic => <details key={topic.id} id={`guide-${topic.id}`} className="guide-topic" open={searching || opened.has(topic.id)} onToggle={event => toggleTopic(topic.id, event.currentTarget.open)}>
            <summary><div><h2>{topic.title}</h2><p>{topic.description}</p></div><ChevronDown size={20} aria-hidden="true" /></summary>
            <div className="guide-body">{topic.blocks.map((block, index) => <GuideBlock key={index} block={block} />)}
              {topic.route && <button type="button" className="btn btn-acc guide-shortcut" onClick={() => onNavigate(topic.route)}>{topic.routeLabel}<ArrowRight size={17} aria-hidden="true" /></button>}
            </div>
          </details>)}
        </>}
      </div>
    </div>
  </div>;
}
