// ══════════════════════════════════════════════════════════════════
//  BasicInfo.jsx — 거래처·품목명·수량·날짜. 견적서 머리글에만 쓰이는 입력들.
//
//  계산에 들어가는 값은 수량(qty) 하나뿐이고, 그 변환은 ui/state.mjs 가 한다.
// ══════════════════════════════════════════════════════════════════
import { Section, Field, Row2, Input } from "../primitives.jsx";

export default function BasicInfo({ s, u }) {
  return (
    <Section title="기본 정보">
      <Field label="거래처"><Input value={s.customer} onChange={v=>u("customer",v)}/></Field>
      <Field label="품목명"><Input value={s.product}  onChange={v=>u("product",v)}/></Field>
      <Row2>
        {/* min/step 은 스피너 힌트일 뿐이다 — 음수는 domain/quote.mjs normQty 가 접는다 */}
        <Field label="수량(EA)"><Input value={s.qty} onChange={v=>u("qty",v)} type="number" min={1} step={1}/></Field>
        <Field label="날짜"><Input value={s.date} onChange={v=>u("date",v)} small/></Field>
      </Row2>
    </Section>
  );
}
