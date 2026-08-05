// ══════════════════════════════════════════════════════════════════
//  DevCostPanel.jsx — 신규 목형 여부와 목형 수량·단가.
//
//  개발비 라인 자체는 domain/process 의 DEV_PROCESSES 가 만든다.
//  여기는 그 입력값만 받는다 (박·형압 개발비 입력은 CoatingPanel 쪽에 있다).
// ══════════════════════════════════════════════════════════════════
import { Section, Field, Row2, Input, Toggle } from "../primitives.jsx";

export default function DevCostPanel({ s, u }) {
  return (
    <Section title="개발비 (목형)">
      <Toggle checked={s.newDie} onChange={v=>u("newDie",v)} label="신규 목형 제작"/>
      {s.newDie && (
        <div style={{marginTop:10}}>
          <Row2>
            <Field label="목형 수량"><Input value={s.dieQ} onChange={v=>u("dieQ",v)} type="number"/></Field>
            <Field label="목형 단가 (원)" note="실제 120,000~240,000원"><Input value={s.dieP} onChange={v=>u("dieP",v)} type="number"/></Field>
          </Row2>
        </div>
      )}
    </Section>
  );
}
