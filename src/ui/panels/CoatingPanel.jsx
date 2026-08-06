// ══════════════════════════════════════════════════════════════════
//  CoatingPanel.jsx — 전·후면 코팅, 부분코팅, 박, 형압 옵션과 그 단가·개발비 입력.
//
//  코팅 종류 목록은 domain/data/process-prices 의 COAT_OPTS 하나만 본다.
//  라인이 1줄로 합쳐지는지 2줄로 갈리는지는 domain/process/coating 이 정한다.
// ══════════════════════════════════════════════════════════════════
import { COAT_OPTS } from "../../domain/data/process-prices.mjs";

// hidden 항목(부분코팅)은 단가 데이터용이라 드롭다운에 띄우지 않는다
const COAT_PICK = COAT_OPTS.filter(o => !o.hidden);
import { Section, Field, Row2, Input, Select, Toggle } from "../primitives.jsx";

export default function CoatingPanel({ s, u }) {
  return (
    <Section title="코팅 / 후가공">
      <Row2>
        <Field label="전면 코팅"><Select value={s.fcId} onChange={v=>u("fcId",v)} options={COAT_PICK}/></Field>
        <Field label="후면 코팅"><Select value={s.bcId} onChange={v=>u("bcId",v)} options={COAT_PICK}/></Field>
      </Row2>
      <Toggle checked={s.puv} onChange={v=>u("puv",v)} label="부분코팅 (95,000원/R)"/>
      {s.puv && (
        <div style={{marginTop:8}}>
          <Field label="부분코팅 면수"><Select value={s.puvS} onChange={v=>u("puvS",v)} options={["1","2"]}/></Field>
        </div>
      )}
      {/* 박 (금박·은박·먹박) */}
      <div style={{marginTop:8}}>
        <Toggle checked={s.foil} onChange={v=>u("foil",v)} label="박 (금박 / 은박 / 먹박)"/>
      </div>
      {s.foil && (
        <div style={{marginTop:8,background:"#080e1c",border:"1px solid #3a3010",borderRadius:4,padding:"10px"}}>
          <div style={{fontSize:9,color:"#ddbb44",fontWeight:700,marginBottom:8}}>박 옵션</div>
          <Row2>
            <Field label="종류">
              <Select value={s.foilType} onChange={v=>u("foilType",v)} options={["금박","은박","먹박","은박/금박"]}/>
            </Field>
            <Field label="면수"><Select value={s.foilS} onChange={v=>u("foilS",v)} options={["1","2"]}/></Field>
          </Row2>
          <Field label="박 공정 단가 (원/R)" note="금박 140,000 · 먹박 120,000 · 양면 100,000">
            <Input value={s.foilRpr} onChange={v=>u("foilRpr",v)} type="number"/>
          </Field>
          <Row2>
            <Field label="동판 (원)"><Input value={s.foilDevP} onChange={v=>u("foilDevP",v)} type="number"/></Field>
            <Field label="동판필름 (원)"><Input value={s.foilFilmP} onChange={v=>u("foilFilmP",v)} type="number"/></Field>
          </Row2>
        </div>
      )}
      {/* 형압(디보싱) */}
      <div style={{marginTop:8}}>
        <Toggle checked={s.emb} onChange={v=>u("emb",v)} label="형압 (디보싱 / 엠보싱)"/>
      </div>
      {s.emb && (
        <div style={{marginTop:8,background:"#080e1c",border:"1px solid #2a1a3a",borderRadius:4,padding:"10px"}}>
          <div style={{fontSize:9,color:"#cc88ff",fontWeight:700,marginBottom:8}}>형압 옵션</div>
          <Field label="형압 공정 단가 (원/R)" note="디보싱 프레스 단가">
            <Input value={s.embRpr} onChange={v=>u("embRpr",v)} type="number"/>
          </Field>
          <Row2>
            <Field label="형압 개발비 (원)"><Input value={s.embDevP} onChange={v=>u("embDevP",v)} type="number"/></Field>
            <Field label="형압 필름 (원)"><Input value={s.embFilmP} onChange={v=>u("embFilmP",v)} type="number"/></Field>
          </Row2>
        </div>
      )}
      <div style={{marginTop:8}}>
        <Field label="부분코팅 필름비 (원)">
          <Input value={s.filmC} onChange={v=>u("filmC",v)} type="number" placeholder="예: 30000"/>
        </Field>
      </div>
    </Section>
  );
}
