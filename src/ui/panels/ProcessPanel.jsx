// ══════════════════════════════════════════════════════════════════
//  ProcessPanel.jsx — 톰슨(도무송)·접착 방식 선택과 일반관리비.
//
//  관리비 자동값은 domain/process/admin 의 calcAdmin 을 그대로 미리보기로 쓴다.
//  화면에 식(100,000 + 수량×5원)을 다시 적으면 정책을 바꿀 때 한쪽만 고쳐진다.
// ══════════════════════════════════════════════════════════════════
import { GLUE_OPTS, THOMSON_OPTS } from "../../domain/data/process-prices.mjs";
import { calcAdmin } from "../../domain/process/admin.mjs";
import { Section, Field, Row2, Input, Select, Toggle } from "../primitives.jsx";

export default function ProcessPanel({ s, u, qty }) {
  return (
    <Section title="가공">
      <Row2>
        <Field label="톰슨 (도무송)"><Select value={s.thomId} onChange={v=>u("thomId",v)} options={THOMSON_OPTS}/></Field>
        <Field label="접착 방식"><Select value={s.glueId} onChange={v=>u("glueId",v)} options={GLUE_OPTS}/></Field>
      </Row2>
      <div style={{marginTop:6}}>
        <Toggle checked={s.adminManual} onChange={v=>u("adminManual",v)} label="일반관리비 직접 입력"/>
      </div>
      {s.adminManual ? (
        <Field label="일반관리비 (원)">
          <Input value={s.admin} onChange={v=>u("admin",v)} type="number"/>
        </Field>
      ) : (
        <div style={{fontSize:10,color:"#4488aa",padding:"5px 8px",background:"#050f1c",borderRadius:3,marginTop:6,lineHeight:1.7}}>
          자동: <strong style={{color:"#88ccdd"}}>{calcAdmin(qty).toLocaleString()}원</strong>
          <div style={{fontSize:8.5,color:"#335566"}}>
            100,000 + 수량×5원 (1만원 단위) ｜ 싸바리·G형은 실측이 더 높음 → 직접 입력 권장
          </div>
        </div>
      )}
    </Section>
  );
}
