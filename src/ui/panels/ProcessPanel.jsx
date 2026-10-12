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
          {/* ★ 26-09-16 — 「출발점일 뿐」이라고 화면이 말하게 한다. 견적서 172건에서 관리비는
              같은 수량에 값이 갈린다(4,000ea 하나만 봐도 다섯 값) — 수량의 함수가 아니라
              건별 재량이다(domain/process/admin.mjs). 그 사실을 숨기면 자동값이 정답처럼 읽힌다. */}
          <div style={{fontSize:8.5,color:"#335566"}}>
            100,000 + 수량×5원 (1만원 단위) — <strong style={{color:"#4488aa"}}>출발점일 뿐</strong>이다.
            실측은 같은 수량에서도 갈린다(건별 재량) → 협의값이 있으면 직접 입력해라
          </div>
        </div>
      )}
    </Section>
  );
}
