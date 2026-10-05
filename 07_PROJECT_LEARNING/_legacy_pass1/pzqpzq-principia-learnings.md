# Forensic Learning Record (Deep Inspection): pzqpzq/Principia

> **Canonical Artifact**: `07_PROJECT_LEARNING/pzqpzq-principia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pzqpzq/Principia](https://github.com/pzqpzq/Principia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:41:43.758Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pzqpzq/Principia`
- **Description**: Principia extracts reusable principles, composes those principles into traceable research ideas, and helps researchers inspect why an idea may be worth testing.
- **Primary Language / Ecosystem**: Rich Text Format
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1055 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ASD-benchmarks/reference/cases/P100-034/research_history/make_engines.py`
```
from pathlib import Path
W=Path(__file__).resolve().parents[1]
run='''"""Standalone frozen equations; prediction reads declared inputs only."""
from pathlib import Path
import json,hashlib
import numpy as np
import pandas as pd
from scipy.special import expit

def read_table(path):return pd.read_csv(path,dtype={'sample_id':str,'group':str})
def features(c,k,d):
 one=np.ones(len(d))
 if c==29:
  q=d.dose/d.dose_cal;A=d.F5-d.F0;X=[one,d.F0,d.F5,d.F2,d.F1,A*np.log(q),A*(1-1/q),d.dye_NR*A,np.log(q)*d.dye_NR*A]
 elif c==32:
  v=d.p0-d.p20;acc=d.p0-2*d.p20+d.p40;flow=d.di0-d.de0
  if k=='periodic':X=[v,acc]
  elif k=='flow':X=[v,flow,d.di0-d.di20,d.de0-d.de20]
  elif k=='regime':X=[v,acc,flow,v*(flow>0),v*d.trial_FEM,v*d.trial_BH]
  elif k=='shutter':X=[v,acc,d.p0-d.p10,d.p10-d.p30,(d.p0-d.p05)-(d.p20-d.p30),v*d.trial_FEM]
  else:X=[one]+[d[x] for x in ['p0','p05','p10','p20','p30','p40','p50','di0','de0','di20','de20']]+[d.p0*d.trial_FEM,d.p0*d.trial_BH]
 elif c==34:
  x=d.calcium;v=d.low075;u=d.low04
  X=[one,v,u,np.log(x/.75)*v,(1-.75/x)*v,np.log(x/.75)*u,d.mutant*v,d.mutant*np.log(x/.75)*v]
 elif c==76:
  x=d.current/50;s=d.soft;k=d.kd;b=d.cal_last
  X=[one,x,x*x,s,k,s*k,x*s,x*k,x*s*k,b,b*x,d.cal_mean]
 elif c==79:
  x=np.log1p(d.hours/24);b=d.baseline
  X=[one,x,x*x,x*x*x,b,b*x,d.baseline_change,d.age/40]
 elif c==89:
  r=d.reward/2;p=d.probability;a=d.child;m=d.multi;v=d.description;h=d.history_mean-.5;l=d.lag_choice-.5;ev=r*p-1
  if k=='utility':X=[one,ev]
  elif k=='context':X=[one,ev,a,m,v,a*m,ev*a,ev*m]
  elif k=='memory':X=[one,ev,a,m,v,a*m,ev*a,ev*m,h,l,d.has_history*h]
  elif k=='description':X=[one,ev,a,m,v,a*m,ev*a,ev*m,h,l,(p-.5)*v,(p-.5)*a*v]
  elif k=='history_interaction':X=[one,ev,a,m,v,a*m,ev*a,ev*m,h,l,h*ev,h*m,h*a]
  else:X=[one,r,p,r*p,r*r,p*p,a,m,v,a*m,a*v,r*a,p*a,r*m,p*m,r*v,p*v,h,l,h*a,h*m,d.trial_progress]
 else:raise ValueError(c)
 return np.column_stack(X).astype(float)
def predict(m,d):
 c=m['case'];k=m['kind'];p=np.asarray(m.get('coef',[]));one=np.ones(len(d))
 if k=='mean':return one*m['mean']
 if c==29:
  x=d.dose.to_numpy();z=d.dose_cal.to_numpy();b=d.F0.to_numpy();A=(d.F5-d.F0).to_numpy()
  if k=='persistence':return d.F5.to_numpy()
  if k=='linear':return b+A*x/z
  if k=='langmuir':K=p[0];H=lambda q:q/(K+q)
  elif k=='hill':K,n=p;H=lambda q:q**n/(K**n+q**n)
  elif k=='two_site':K1,K2,w=p;H=lambda q:w*q/(K1+q)+(1-w)*q/(K2+q)
  elif k=='dye_hill':K=np.exp(p[0]+p[1]*d.dye_NR.to_numpy());n=p[2];H=lambda q:q**n/(K**n+q**n)
  elif k in ['local','shrink_local']:
   # Invert low-dose Langmuir ratio only from calibration, not future maximum.
   r=(d.F2-d.F0).to_numpy()/np.maximum(A,1e-8);x2=d.dose2.to_numpy();K=np.clip(x2*z*(1-r)/np.maximum(r*z-x2,1e-8),.01,1000)
   if k=='local':K=K*p[0]
   else:K=np.exp(p[0]*np.log(K)+(1-p[0])*np.log(p[1]))
   H=lambda q:q/(K+q)
  elif k=='threshold':n,K,lag=p;L=lag*z;H=lambda q:np.maximum(q-L,1e-8)**n/(K**n+np.maximum(q-L,1e-8)**n)
  elif k=='flexible':return np.maximum(0,features(c,k,d)@p)
  else:raise ValueError(k)
  return b+A*H(x)/np.maximum(H(z),1e-12)
 if c==32:
  if k=='persistence':return d.p0.to_numpy()
  if k=='tangent':return (d.p0+2*(d.p0-d.p10)).to_numpy()
  if k=='damped':return (d.p0+p[0]*(d.p0-d.p10)).to_numpy()
  if k=='limited':return (d.p0+p[0]*np.tanh((d.p0-d.p20)/p[1])*p[1]).to_numpy()
  if k in ['periodic','flow','regime','shutter']:return d.p0.to_numpy()+features(c,k,d)@p
  return features(c,k,d)@p
 if c==34:
  x=d.calcium.to_numpy();z=.75;v=d.low075.to_numpy();u=d.low04.to_numpy();g=d.mutant.to_numpy()
  if k=='persistence':return v
  if k=='hill4':K=p[0];n=4
  elif k=='genotype_hill':K=np.exp(p[0]+p[1]*g);n=p[2]
  elif k=='local_hill':
   n=p[0];r=np.clip(u/np.maximum(v,1e-8),1e-7,.99999);q=.4**n;s=z**n;K=np.maximum(q*s*(1-r)/np.maximum(r*s-q,1e-12),.000001)**(1/n)
  elif k=='two_pool':
   K1,K2,w=p;H=lambda t:w*t**4/(K1**4+t**4)+(1-w)*t**4/(K2**4+t**4);return v*H(x)/H(z)
  elif k=='genotype_exponent':K=np.exp(p[0]+p[1]*g);n=p[2]+p[3]*g
  elif k=='calibration_blend':
   K,n,w=p;H=lambda t:t**n/(K**n+t**n);glob=v*H(x)/H(z);slope=np.maximum(v-u,0)/.35;local=v+slope*K*(1-np.exp(-(x-z)/K));return (1-w)*glob+w*local
  elif k=='capacity':return np.maximum(0,v+p[0]*(1-np.exp(-(x-z)/p[1]))*(1+p[2]*g))
  elif k=='flexible':return np.maximum(0,features(c,k,d)@p)
  else:raise ValueError(k)
  H=lambda t:t**n/(K**n+t**n);return v*H(x)/H(z)
 if c==76:
  x=d.current.to_numpy();b=d.cal_last.to_numpy();s=d.soft.to_numpy();g=d.kd.to_numpy()
  if k=='persistence':return b
  if k=='rheobase':return np.maximum(0,p[0]*(x-p[1]))
  if k=='condition_threshold':return np.maximum(0,p[0]*(x-p[1]-p[2]*s-p[3]*g-p[4]*s*g))
  if k=='saturation':return b+p[0]*(1-np.exp(-np.maximum(x-10,0)/p[1]))
  if k=='recruitment':return np.maximum(0,(p[0]+p[1]*b+p[2]*d.cal_mean.to_numpy())*np.maximum(x-10,0))
  if k=='block':return b+p[0]*np.maximum(x-10,0)*np.exp(-np.maximum(x-p[1],0)/p[2])
  if k=='condition_gain':return b+np.maximum(0,p[0]+p[1]*s+p[2]*g+p[3]*s*g)*np.maximum(x-10,0)**p[4]
  if k=='calibrated_saturation':return b+(p[0]+p[1]*b)*(1-np.exp(-(x-10)/p[2]))
  if k=='flexible':return np.maximum(0,features(c,k,d)@p)
  raise ValueError(k)
 if c==79:
  t=d.hours.to_numpy();b=d.baseline.to_numpy();v=d.baseline_change.to_numpy()
  if k=='persistence':return b
  if k=='decay':return np.maximum(0,b+p[0]*np.exp(-t/p[1]))
  if k=='bateman':return np.maximum(0,b+p[0]*(np.exp(-t/p[1])-np.exp(-t/p[2])))
  if k=='relative_decay':return np.maximum(0,b+b*p[0]*np.exp(-t/p[1]))
  if k=='two_decay':return np.maximum(0,b+p[0]*np.exp(-t/p[1])+p[2]*np.exp(-t/p[3]))
  if k=='baseline_drift':return np.maximum(0,b+p[0]*np.exp(-t/p[1])+p[2]*v*np.exp(-t/24))
  if k=='lognormal':return np.maximum(0,b+p[0]*np.exp(-.5*(np.log(t/p[1])/p[2])**2))
  if k=='saturating_amplitude':return np.maximum(0,b+p[0]*b/(p[1]+np.maximum(b,0))*np.exp(-t/p[2]))
  if k=='flexible':return np.maximum(0,features(c,k,d)@p)
  raise ValueError(k)
 if c==89:
  if k=='persistence':return np.clip(d.history_mean.to_numpy(),.001,.999)
  if k=='prospect':
   alpha,gamma,beta,bias=p;r=d.reward.to_numpy()/2;prob=d.probability.to_numpy();w=prob**gamma/(prob**gamma+(1-prob)**gamma)**(1/gamma);return expit(beta*(w*r**alpha-1)+bias)
  return expit(features(c,k,d)@p)
 raise ValueError(c)
def main():
 here=Path(__file__).resolve().parent;manifest=json.loads((here/'MANIFEST.json').read_text())
 for a in manifest['assets']:
  p=here/a['path']
  if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=a['sha256']:raise ValueError('Integrity failure '+a['path'])
 r=json.loads((here/'rules.json').read_text());d=read_table(here/'data/inputs.csv.gz');saved=read_table(here/'evidence/predictions.csv.gz')
 for k,m in r['models'].items():
  q=predict(m,d)
  if not np.isfinite(q).all() or not np.allclose(q,saved[k],rtol=1e-10,atol=1e-9):raise ValueError('Replay mismatch '+k)
 print('All frozen models reproduce saved predictions',len(d))
if __name__=='__main__':main()
'''
fit='''from pathlib import Path
import json,hashlib
import numpy as np
from scipy.optimize import least_squares,minimize
from scipy.special import expit
from run import predict,features
BOUNDS={29:{'langmuir':([5],[.001],[1000]),'hill':([5,1],[.001,.1],[1000,4]),'local':([1],[.01],[100]),'two_site':([1,50,.5],[.001,.01,0],[1000,1000,1]),'dye_hill':([2,0,1],[-6,-6,.1],[8,6,4]),'threshold':([1,5,.2],[.1,.001,0],[4,1000,.95]),'shrink_local':([.5,5],[0,.001],[1,1000])},32:{'damped':([1],[-2],[3]),'limited':([1,2],[-2,.001],[4,50])},34:{'hill4':([1],[.01],[100]),'genotype_hill':([0,0,3],[-4,-4,.5],[5,4,6]),'local_hill':([3],[1],[6]),'two_pool':([.5,3,.5],[.01,.02,0],[100,100,1]),'genotype_exponent':([0,0,3,0],[-4,-4,1,-.9],[5,4,5,1]),'calibration_blend':([1,3,.5],[.01,.5,0],[100,6,1]),'capacity':([50000,1,0],[0,.01,-.95],[1e7,100,10])},76:{'rheobase':([.1,0],[0,-50],[10,100]),'condition_threshold':([.1,0,0,0,0],[0,-50,-100,-100,-100],[10,100,100,100,100]),'saturation':([10,40],[0,.1],[200,1000]),'recruitment':([.1,.01,.01],[0,0,0],[10,10,10]),'block':([.2,50,40],[0,10,.1],[10,100,1000]),'condition_gain':([.1,0,0,0,1],[0,-5,-5,-5,.1],[5,5,5,5,2]),'calibrated_saturation':([10,1,40],[0,0,.1],[200,50,1000])},79:{'decay':([.1,20],[0,.01],[10,1000]),'bateman':([.1,24,1],[0,.1,.01],[10,1000,48]),'relative_decay':([2,24],[0,.01],[1000,1000]),'two_decay':([.05,2,.05,48],[0,.01,0,1],[10,48,10,1000]),'baseline_drift':([.1,24,0],[0,.01,-5],[10,1000,5]),'lognormal':([.1,1,1],[0,.1,.05],[10,96,5]),'saturating_amplitude':([.1,.01,24],[0,.000001,.01],[10,1,1000])},89:{'prospect':([1,1,1,0],[.1,.1,.01,-10],[4,4,30,10])}}
BASE={29:['persistence','linear','langmuir','flexible'],32:['persistence','tangent','flexible'],34:['persistence','hill4','flexible'],76:['persistence','rheobase','flexible'],79:['persistence','decay','flexible'],89:['mean','utility','persistence','flexible']}
EQ={
29:{'persistence':'Fhat=F5','linear':'Fhat=F0+(F5-F0)*dose/dose_cal','langmuir':'Fhat=F0+(F5-F0)*H(dose)/H(dose_cal); H(x)=x/(K+x)','hill':'Fhat=F0+(F5-F0)*H(dose)/H(dose_cal); H(x)=x^n/(K^n+x^n)','local':'Langmuir normalized at calibration dose; K inverted from F2/F5 baseline-subtracted ratio then multiplied by fitted factor','two_site':'H(x)=w*x/(K1+x)+(1-w)*x/(K2+x), amplitude fixed by low-dose calibration','dye_hill':'Hill H with log K=b0+b1*dye_NR and common exponent n','threshold':'H(x)=max(x-lag*dose_cal,epsilon)^n/(K^n+max(x-lag*dose_cal,epsilon)^n)','shrink_local':'log K=w*log K_local+(1-w)*log K_shared'},
32:{'persistence':'p_hat(t+.2)=p(t)','tangent':'p_hat(t+.2)=p(t)+2*(p(t)-p(t-.1))','damped':'p_hat=p0+a*(p0-p10)','periodic':'p_hat=p0+a*(p0-p20)+b*(p0-2*p20+p40)','flow':'p_hat=p0+a*(p0-p20)+b*(di0-de0)+c*(di0-di20)+d*(de0-de20)','regime':'p_hat=p0+beta dot [v,acc,flow,v*I(flow>0),v*FEM,v*BH]','limited':'p_hat=p0+a*s*tanh((p0-p20)/s)','shutter':'p_hat=p0+beta dot [v,acc,p0-p10,p10-p30,(p0-p05)-(p20-p30),v*FEM]'},
34:{'persistence':'Ihat=I(.75)','hill4':'Ihat=I(.75)*H(C)/H(.75); H(C)=C^4/(K^4+C^4)'
```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/App.tsx`
```
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Shell } from "./components/Shell";
import { LibraryPage } from "./pages/LibraryPage";
import { MapPage } from "./pages/MapPage";

const ResearchWorkspacePage = lazy(async () => {
  const module = await import("./pages/ResearchWorkspacePage");
  return { default: module.ResearchWorkspacePage };
});

function ResearchWorkspaceRoute() {
  const location = useLocation();
  return (
    <Suspense
      fallback={
        <main className="route-loading" role="status" aria-live="polite">
          <span className="route-loading-mark" aria-hidden="true" />
          <strong>Opening your research workspace…</strong>
          <span>Restoring the project map and saved run.</span>
        </main>
      }
    >
      <ResearchWorkspacePage key={location.pathname} />
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/research/new" element={<ResearchWorkspaceRoute />} />
        <Route path="/research/:sessionId" element={<ResearchWorkspaceRoute />} />
        <Route path="/library" element={<Navigate to="/research/new" replace />} />
        <Route path="/map" element={<MapPage />} />
        <Route
          path="/local"
          element={<Navigate to="/research/new?settings=local" replace />}
        />
        <Route path="/legacy/library" element={<LibraryPage />} />
        <Route path="*" element={<Navigate to="/research/new" replace />} />
      </Route>
    </Routes>
  );
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/api/client.ts`
```
import createClient from "openapi-fetch";
import type { paths } from "./schema";

const session =
  document.querySelector<HTMLMetaElement>('meta[name="principia-session"]')?.content ?? "";

export const api = createClient<paths>({
  baseUrl: "",
  headers: session ? { "X-Principia-Session": session } : undefined,
});

export class ApiError extends Error {
  requestId: string;
  retryable: boolean;
  category: string;

  constructor(error: unknown) {
    const raw = error as {
      error?: { message?: string; request_id?: string; retryable?: boolean; category?: string };
      message?: string; request_id?: string; retryable?: boolean; category?: string;
    };
    const body = raw?.error ?? raw;
    super(body?.message ?? "Principia could not complete the request.");
    this.name = "ApiError";
    this.requestId = body?.request_id ?? "";
    this.retryable = Boolean(body?.retryable);
    this.category = body?.category ?? "runtime";
  }
}

export function dataOrThrow<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) throw new ApiError(result.error);
  if (result.data === undefined) throw new ApiError(undefined);
  return result.data;
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/api/schema.d.ts`
```
/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */

export interface paths {
    "/api/v1/areas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Areas */
        get: operations["areas_api_v1_areas_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/areas/catalog/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Refresh Catalog */
        post: operations["refresh_catalog_api_v1_areas_catalog_refresh_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/areas/{area}/install": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Install Area */
        post: operations["install_area_api_v1_areas__area__install_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/areas/{area}/pin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Pin Area */
        post: operations["pin_area_api_v1_areas__area__pin_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/areas/{area}/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rollback Area */
        post: operations["rollback_area_api_v1_areas__area__rollback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/areas/{area}/update": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Update Area */
        post: operations["update_area_api_v1_areas__area__update_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/areas/{area}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify Area */
        post: operations["verify_area_api_v1_areas__area__verify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/graph/sample": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Graph Sample */
        get: operations["cloud_graph_sample_api_v1_cloud_graph_sample_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/graph/viewport": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Graph Viewport */
        get: operations["cloud_graph_viewport_api_v1_cloud_graph_viewport_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/meta-principles/{principle_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Meta Principle */
        get: operations["cloud_meta_principle_api_v1_cloud_meta_principles__principle_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/meta-principles/{principle_id}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Meta Principle Revisions */
        get: operations["cloud_meta_principle_revisions_api_v1_cloud_meta_principles__principle_id__revisions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/principles/{principle_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Principle */
        get: operations["cloud_principle_api_v1_cloud_principles__principle_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/principles/{principle_id}/foundations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Principle Foundations */
        get: operations["cloud_principle_foundations_api_v1_cloud_principles__principle_id__foundations_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/principles/{principle_id}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Principle Revisions */
        get: operations["cloud_principle_revisions_api_v1_cloud_principles__principle_id__revisions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/rollback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cloud Rollback */
        post: operations["cloud_rollback_api_v1_cloud_rollback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cloud Search */
        post: operations["cloud_search_api_v1_cloud_search_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Status */
        get: operations["cloud_status_api_v1_cloud_status_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cloud Sync */
        post: operations["cloud_sync_api_v1_cloud_sync_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/works/{work_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Work */
        get: operations["cloud_work_api_v1_cloud_works__work_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cloud/works/{work_id}/revisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cloud Work Revisions */
        get: operations["cloud_work_revisions_api_v1_cloud_works__work_id__revisions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/data-derived-principle-drafts/{draft_id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve Data Derived Principle */
        post: operations["approve_data_derived_principle_api_v1_data_derived_principle_drafts__draft_id__approve_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/data-derived-principle-drafts/{draft_id}/reject": {
        parameters: {
            query?: nev
```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/AsyncState.tsx`
```
import type { ReactNode } from "react";
import { ApiError } from "../api/client";

export function LoadingState({ label = "Loading Principia…" }: { label?: string }) {
  return (
    <div className="state-card" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div>
        <strong>{label}</strong>
        <p>Reading verified local state.</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-glyph" aria-hidden="true">◇</span>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const apiError = error instanceof ApiError ? error : new ApiError(error);
  return (
    <div className={`state-card error ${apiError.retryable ? "retryable" : ""}`} role="alert">
      <span className="status-dot danger" aria-hidden="true" />
      <div>
        <strong>{apiError.message}</strong>
        <p>
          {apiError.category} · Request {apiError.requestId || "not available"}
        </p>
        {retry && apiError.retryable ? <button onClick={retry}>Retry</button> : null}
      </div>
    </div>
  );
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/CloudStatusControl.tsx`
```
import { useEffect, useRef, useState } from "react";

type CloudStatus = Record<string, unknown>;

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const countLabel = (value: unknown): string =>
  numberValue(value).toLocaleString();

const dateLabel = (value: unknown): string => {
  const raw = textValue(value);
  if (!raw) return "Not available";
  const date = new Date(raw);
  return Number.isNaN(date.valueOf())
    ? raw
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
};

export function CloudStatusControl({
  status,
  fetching = false,
  refreshing = false,
  onRefresh,
}: {
  status: CloudStatus;
  fetching?: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const total =
    status.total_principle_count ?? status.principle_count ?? 0;
  const available = Boolean(status.available);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="research-cloud-state"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${countLabel(total)} Principles ready, open Cloud status`}
        onClick={() => setOpen(true)}
      >
        <span
          className={`status-dot ${available ? "online" : "warning"}`}
          aria-hidden="true"
        />
        <strong>{countLabel(total)}</strong>
        <small>Principles ready</small>
      </button>

      {open ? (
        <div
          className="cloud-status-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="cloud-status-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cloud-status-title"
          >
            <header>
              <div>
                <span className="eyebrow">Live Cloud status</span>
                <h2 id="cloud-status-title">Global Principles Cloud</h2>
                <p>
                  {available
                    ? "This verified snapshot powers Global search and the living map."
                    : "No verified Cloud snapshot is active in this workspace."}
                </p>
              </div>
              <button
                ref={closeButton}
                type="button"
                className="cloud-status-close"
                aria-label="Close Cloud status"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="cloud-status-total">
              <span className={`status-dot ${available ? "online" : "warning"}`} />
              <div>
                <strong>{countLabel(total)}</strong>
                <small>active Principles in the unified Cloud</small>
              </div>
              {fetching || refreshing || Boolean(status.syncing) ? (
                <span className="cloud-live-indicator">Updating…</span>
              ) : (
                <span className="cloud-live-indicator ready">Live</span>
              )}
            </div>

            <dl className="cloud-status-metrics">
              <div>
                <dt>Literature Principles</dt>
                <dd>
                  {countLabel(
                    status.literature_principle_count ?? status.principle_count,
                  )}
                </dd>
              </div>
              <div>
                <dt>Meta-Principles</dt>
                <dd>{countLabel(status.meta_principle_count)}</dd>
              </div>
              <div>
                <dt>Scientific works</dt>
                <dd>{countLabel(status.work_count)}</dd>
              </div>
              <div>
                <dt>Provenance links</dt>
                <dd>{countLabel(status.principle_work_count)}</dd>
              </div>
              <div>
                <dt>Principle relations</dt>
                <dd>{countLabel(status.relation_count)}</dd>
              </div>
              <div>
                <dt>Foundation links</dt>
                <dd>{countLabel(status.foundation_link_count)}</dd>
              </div>
              <div>
                <dt>Scientific areas</dt>
                <dd>{countLabel(status.area_count)}</dd>
              </div>
              <div>
                <dt>Snapshot size</dt>
                <dd>
                  {numberValue(status.snapshot_bytes)
                    ? `${(numberValue(status.snapshot_bytes) / 1_048_576).toFixed(1)} MiB`
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="cloud-status-provenance">
              <div>
                <span>Verified release</span>
                <strong>{textValue(status.release_id) || "Not installed"}</strong>
              </div>
              <div>
                <span>Cloud updated</span>
                <strong>{dateLabel(status.updated_at)}</strong>
              </div>
              <div>
                <span>Embedding contract</span>
                <strong>{textValue(status.embedding_contract) || "FTS fallback"}</strong>
              </div>
            </div>

            {textValue(status.last_error) ? (
              <p className="cloud-status-warning" role="status">
                The last update check did not complete. The previous verified
                snapshot remains active and searchable.
              </p>
            ) : null}

            <footer>
              <small>
                Counts refresh automatically while Principia is open. Snapshot
                activation is atomic, so searches never see a partial update.
              </small>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing || Boolean(status.syncing)}
              >
                {refreshing || Boolean(status.syncing)
                  ? "Checking…"
                  : "Check for updates"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/CustomPrincipleForm.tsx`
```
import { useState } from "react";
import type { components } from "../api/schema";
import { ErrorState } from "./AsyncState";

type Proposal = components["schemas"]["CustomPrincipleProposal"];
const fields = [
  ["title", "Title", 8, 180],
  ["area", "Area", 2, 63],
  ["claim", "Claim", 20, 2400],
  ["scope_statement", "Scope statement", 12, 1200],
  ["falsifier", "Falsifier", 12, 1200],
  ["synthesis_summary", "Synthesis summary", 20, 1600],
  ["reliability_rationale", "Reliability rationale", 20, 1200],
  ["novelty_rationale", "Novelty rationale", 20, 1200],
] as const;
const lists = [["conditions", "Conditions"], ["exclusions", "Exclusions"], ["assumptions", "Assumptions"]] as const;
const levels: Array<[Proposal["derivation_level"], string]> = [
  ["direct_composition", "Direct composition"],
  ["cross_context_generalization", "Cross-context generalization"],
  ["boundary_hypothesis", "Boundary hypothesis"],
  ["mechanistic_bridge", "Mechanistic bridge"],
];

export function CustomPrincipleForm({ onSave }: {
  onSave: (proposal: Proposal) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({ derivation_level: "direct_composition" });
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const update = (key: string, value: string) => {
    setDraft(current => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || saved) return;
    setError(null);
    try {
      const values = Object.fromEntries(fields.map(([key, label, min, max]) => {
        const value = (draft[key] || "").trim();
        if (value.length < min || value.length > max) throw new Error(`${label} must contain ${min}–${max} characters.`);
        return [key, value];
      })) as Pick<Proposal, (typeof fields)[number][0]>;
      if (!/^[a-z0-9][a-z0-9-]+$/.test(values.area)) throw new Error("Area must use lowercase letters, numbers, and hyphens.");
      const arrayValues = Object.fromEntries(lists.map(([key, label]) => {
        const value = (draft[key] || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (value.length > 12) throw new Error(`${label} may contain at most 12 entries.`);
        return [key, value];
      }));
      const scores = Object.fromEntries(["reliability_score", "novelty_score"].map(key => {
        const value = Number(draft[key]);
        if (!draft[key]?.trim() || !Number.isFinite(value) || value < 0 || value > 100)
          throw new Error("Enter reliability and novelty scores between 0 and 100.");
        return [key, value];
      })) as Pick<Proposal, "reliability_score" | "novelty_score">;
      setPending(true);
      await onSave({ ...values, ...arrayValues, ...scores, derivation_level: draft.derivation_level as Proposal["derivation_level"],
        contributing_principle_ids: [] });
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  };
  return <form className="custom-principle-form" onSubmit={submit}>
    <p>Use the same scientific fields as AI Polish. No parent Principle selection is required. Saved Principles remain unreviewed hypotheses.</p>
    <fieldset disabled={pending || saved}>
      {fields.map(([key, label, min, max]) => <label key={key}>
        <span>{label} <small>{min}–{max} characters</small></span>
        {key === "title" || key === "area"
          ? <input aria-label={label} required minLength={min} maxLength={max} pattern={key === "area" ? "[a-z0-9][a-z0-9-]+" : undefined} value={draft[key] || ""} onChange={event => update(key, event.target.value)} />
          : <textarea aria-label={label} required minLength={min} maxLength={max} rows={3} value={draft[key] || ""} onChange={event => update(key, event.target.value)} />}
      </label>)}
      <label><span>Derivation level</span><select aria-label="Derivation level" value={draft.derivation_level} onChange={event => update("derivation_level", event.target.value)}>
        {levels.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {lists.map(([key, label]) => <label key={key}><span>{label} <small>Optional · one per line, up to 12</small></span>
        <textarea aria-label={label} rows={2} value={draft[key] || ""} onChange={event => update(key, event.target.value)} />
      </label>)}
      <div className="custom-principle-scores">{([["reliability_score", "Reliability score"], ["novelty_score", "Novelty score"]] as const).map(([key, label]) => <label key={key}><span>{label}</span>
        <input aria-label={label} type="number" required min={0} max={100} step="any" value={draft[key] || ""} onChange={event => update(key, event.target.value)} />
      </label>)}</div>
      <button className="primary full" type="submit">{pending ? "Saving…" : saved ? "Saved locally and added" : "Save locally & add to graph"}</button>
    </fieldset>
    {error ? <ErrorState error={error} /> : null}
    {saved ? <p className="inline-success" role="status">Custom Principle saved locally and added to the graph.</p> : null}
  </form>;
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/DataDiscoveryPhases.tsx`
```
const PHASES = ["inventory", "understand", "analyze", "challenge", "synthesize"] as const;

export function DataDiscoveryPhases({
  phase,
  complete = false,
  runState = "",
}: {
  phase: string;
  complete?: boolean;
  runState?: string;
}) {
  const current = Math.max(0, PHASES.indexOf(phase as (typeof PHASES)[number]));
  return (
    <ol className="data-phases" aria-label="Discovery phases">
      {PHASES.map((value, index) => {
        const stopped = ["failed", "cancelled", "interrupted"].includes(runState);
        const state = stopped
          ? index < current ? "done" : index === current ? "stopped" : "pending"
          : complete
          ? "done"
          : index < current
            ? "done"
            : index === current
              ? "active"
              : "pending";
        return (
          <li key={value} className={state} aria-current={state === "active" ? "step" : undefined}>
            <span>{index + 1}</span>
            {value}
            <small className="visually-hidden">{state}</small>
          </li>
        );
      })}
    </ol>
  );
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/DemoProjectInfo.tsx`
```
import { useState } from "react";
import { FocusDialog } from "./FocusDialog";

export function DemoProjectInfo({ demo }: { demo: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const sources = (Array.isArray(demo.source_access) ? demo.source_access : []) as Array<Record<string, unknown>>;
  return <>
    <button type="button" className="demo-info-button" onClick={() => setOpen(true)}>Dataset & evidence</button>
    {open ? <FocusDialog title="About this public demo" resizable onClose={() => setOpen(false)}>
      <p>{String(demo.description || "A curated discovery from public data.")}</p>
      {demo.editorial_review ? <><h3>Why this example</h3><p>{String(demo.editorial_review)}</p></> : null}
      <p>Equations, recorded tests, study maps, and derived evidence are included. The original raw dataset is not bundled.</p>
      <h3>Public source data</h3>
      <ul>{sources.map((source, index) => <li key={index}>
        {String(source.url || "").startsWith("https://") ? <a href={String(source.url)} target="_blank" rel="noreferrer">{String(source.title || "Open the public dataset")} ↗</a> : <span>{String(source.title || "Public dataset")}</span>}
        {source.license ? <p>{String(source.license)}</p> : null}
      </li>)}</ul>
      <h3>Evidence boundary</h3>
      <p>{String(demo.evidence_boundary || "Recorded evidence is available offline. Reconnect source data to run a new discovery.")}</p>
      <p>These are selected examples. Consult each Rule’s validation scope and limitations before applying it to new measurements.</p>
      <div className="project-dialog-actions"><button onClick={() => setOpen(false)}>Close</button></div>
    </FocusDialog> : null}
  </>;
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/DialogResizeHandle.tsx`
```
import { useEffect, useRef, type PointerEvent, type KeyboardEvent } from 'react';

export function dialogDimensions(width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const maxWidth = Math.max(1, viewportWidth - 24), maxHeight = Math.max(1, viewportHeight - 24);
  return { width: Math.max(Math.min(340, maxWidth), Math.min(width, maxWidth)), height: Math.max(Math.min(260, maxHeight), Math.min(height, maxHeight)) };
}

/** Resize the dialog frame, so headers and scroll regions share the same bounds. */
export function DialogResizeHandle() {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resize = (width: number, height: number) => {
    const frame = ref.current?.closest<HTMLElement>('[role="dialog"]');
    if (!frame) return;
    const size = dialogDimensions(width, height, window.innerWidth, window.innerHeight);
    frame.style.width = `${size.width}px`; frame.style.height = `${size.height}px`;
    frame.dataset.resized = 'true';
  };
  useEffect(() => {
    const constrain = () => { const frame = ref.current?.closest<HTMLElement>('[role="dialog"]'); if (frame?.dataset.resized) { const rect = frame.getBoundingClientRect(); resize(rect.width, rect.height); } };
    window.addEventListener('resize', constrain);
    return () => window.removeEventListener('resize', constrain);
  }, []);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    const frame = event.currentTarget.closest('[role="dialog"]'); if (!frame) return;
    const rect = frame.getBoundingClientRect(); drag.current = { x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
  };
  const keyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault(); const frame = event.currentTarget.closest<HTMLElement>('[role="dialog"]'); if (!frame) return;
    if (event.key === 'Home') { frame.style.removeProperty('width'); frame.style.removeProperty('height'); delete frame.dataset.resized; return; }
    const rect = frame.getBoundingClientRect(), step = event.shiftKey ? 80 : 20;
    resize(rect.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), rect.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
  };
  return <button ref={ref} type="button" className="dialog-resize-handle" aria-label="Resize dialog" title="Drag to resize · arrow keys adjust size · Home resets" onPointerDown={start}
    onPointerMove={event => { if (drag.current) resize(drag.current.width + 2 * (event.clientX - drag.current.x), drag.current.height + 2 * (event.clientY - drag.current.y)); }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={keyboard}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 16 10-10M11 16l5-5" /></svg></button>;
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/DiscoveryActivityDialog.tsx`
```
import type { ReactNode } from 'react';
import { FocusDialog } from './FocusDialog';
import { DataDiscoveryPhases } from './DataDiscoveryPhases';
import { ResearchRunStatus, finishedResearchStates } from './ResearchRunStatus';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
export function inventorySize(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Inventory pending';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']; let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toLocaleString(undefined, { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
}
export function DiscoveryActivityDialog({ study, sources, counts, cancelling, error, onStop, onClose, onResults, children }: {
  study: RecordValue; sources: { source_id: string; display_name: string; display_location?: string }[]; counts: RecordValue;
  cancelling: boolean; error?: string; onStop: () => void; onClose: () => void; onResults: () => void; children?: ReactNode;
}) {
  const request = record(study.request), coverage = record(study.coverage), job = record(study.job), execution = record(study.execution);
  const resolved = record(coverage.resolved_models), state = text(study.state), complete = finishedResearchStates.has(state);
  const sourceIds = (Array.isArray(study.source_ids) ? study.source_ids : Array.isArray(request.source_ids) ? request.source_ids : []).map(String);
  const inventories = Array.isArray(coverage.sources) ? coverage.sources.map(record) : [];
  const model = (kind: 'reasoning_model' | 'vision_model') => text(resolved[kind]) || (kind === 'reasoning_model' ? text(job.model) : '') || (text(request[kind]) === 'auto' ? 'Auto · awaiting model selection' : text(request[kind])) || 'Auto · awaiting model selection';
  return <FocusDialog title="Discovery activity" resizable onClose={onClose}>
    <div className="discovery-activity">
      <header><div><small>Current discovery task</small><h2>Discovery activity</h2></div><button aria-label="Close discovery activity" title="Close activity; discovery continues" onClick={onClose}>×</button></header>
      <div className="discovery-activity-scroll">
        <ResearchRunStatus kind="discovery" state={state} phase={text(study.phase)} message={text(job.status_message)} startedAt={text(study.created_at)} lastActivityAt={text(job.last_activity_at)} tests={Number(counts.tests || 0)} findings={Number(counts.supported_findings || 0)} cancelling={cancelling} connectionError={error} />
        <DataDiscoveryPhases phase={text(study.phase)} complete={complete} runState={state} />
        <p className="activity-progress-note">Progress follows completed analysis stages. Model requests have no reliable percentage estimate.</p>
        {Number(execution.queue_position) > 0 ? <p role="status">Queue position {Number(execution.queue_position)} · {Number(execution.active_workers || 0)} workers active</p> : null}
        <section><h3>Research objective</h3><p>{text(request.objective) || 'Discover scientifically interpretable relationships in the selected data.'}</p></section>
        <section><h3>Settings for this run</h3><dl className="activity-settings">
          <div><dt>Provider</dt><dd>{text(request.provider) || 'Local analysis'}</dd></div>
          <div><dt>Depth</dt><dd>{text(request.budget) || 'Balanced'}</dd></div>
          <div><dt>Reasoning model</dt><dd>{model('reasoning_model')}</dd></div>
          <div><dt>Vision model</dt><dd>{model('vision_model')}</dd></div>
          <div><dt>Knowledge sources</dt><dd>{text(request.knowledge_scope) || 'Combined'}</dd></div>
          <div><dt>Started</dt><dd>{text(study.created_at) ? new Date(text(study.created_at)).toLocaleString() : 'Waiting to start'}</dd></div>
        </dl><p className="activity-progress-note">Models show this run’s saved selection; Auto is resolved when the provider is contacted.</p></section>
        <section><h3>Selected data · {sourceIds.length} {sourceIds.length === 1 ? 'folder' : 'folders'}</h3>
          <p>{typeof coverage.total_bytes === 'number' ? `${Number(coverage.asset_count || 0).toLocaleString()} files inventoried · ${inventorySize(coverage.total_bytes)} · ${Number(coverage.view_count || 0).toLocaleString()} analyzable views` : 'File counts and sizes appear as each folder is inventoried.'}</p>
          <ul className="activity-sources">{sourceIds.map(id => { const source = sources.find(item => item.source_id === id), inventory = inventories.find(item => item.source_id === id); return <li key={id}><strong>{source?.display_name || id}</strong>{source?.display_location ? <span>{source.display_location}</span> : null}<small>{inventory ? `${Number(inventory.asset_count || 0).toLocaleString()} files · ${inventorySize(inventory.total_bytes)}` : complete ? 'No per-folder inventory receipt was saved for this run' : 'Inventory pending'}</small></li>; })}</ul>
        </section>
        <section><h3>Recent activity</h3>{children}</section>
      </div>
      <footer><span>{complete ? 'Completed evidence remains available.' : cancelling ? 'Stopping active work…' : 'You can close this window while discovery continues.'}</span><button onClick={onResults}>View results</button>{!complete ? <button className="activity-stop" disabled={cancelling} onClick={onStop}>{cancelling ? 'Stopping…' : 'Stop discovery'}</button> : null}</footer>
    </div>
  </FocusDialog>;
}

```

### Core Architecture Module: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/FocusDialog.tsx`
```
import { useEffect, useRef, type ReactNode } from "react";
import { DialogResizeHandle } from "./DialogResizeHandle";
import { createPortal } from "react-dom";

export function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;
  const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
  ));
  const first = elements[0];
  const last = elements.at(-1);
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function FocusDialog({ title, children, onClose, returnFocus, resizable = false }: { title: string; children: ReactNode; onClose: () => void; returnFocus?: HTMLElement | null; resizable?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const background = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(ref.current));
    const originalInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    ref.current?.querySelector<HTMLElement>('input, button, [tabindex="0"]')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
    };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); background.forEach((element, index) => { element.inert = originalInert[index]; }); (returnFocus?.isConnected ? returnFocus : previous)?.focus(); };
  }, []);
  return createPortal(
    <div className="project-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`project-dialog${resizable ? " resizable-dialog" : ""}`} onKeyDown={trapDialogFocus}>
        <h2>{title}</h2>{children}{resizable ? <DialogResizeHandle /> : null}
      </section>
    </div>, document.body,
  );
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #42** (2026-09-10): **Feat/optimizing generation principles**
  *Symptoms*: ## Summary - Added Custom / AI Polish support to the Add Local Principle flow. - Reduced initial page complexity by building and connecting principles for selected topics. - Fixed Virtual Hypothesis cleanup, layer ordering, button consistency, and page layout consistency.  ### Features - Added **Custom / AI Polish** options when adding a Local Principle. - Reduced initial page complexity by generating principles for selected topics and connecting them.  ### Fixes - Cleared residual Virtual Hypotheses from the **Derive Connection** card after generation. - Updated layer display: moved Virtual Hypothesis lines below the Principles description layer. - Unified button styles: renamed the **Results** button to **Manage Principles** and removed the count display. - Standardized the page layout: bottom-left is the status control area, bottom-right is the action area; moved the **Starlight** button from bottom-right to bottom-left.

- **Issue #40** (2026-09-06): **feat: improve research graph visualization**
  *Symptoms*: 

- **Issue #39** (2026-08-23): **v1.4.1: live Cloud status and recoverable publication concurrency**
  *Symptoms*: ## Outcome  - Turns the regular workspace's “Principles ready” indicator into an accessible Cloud-status dialog with live counts, release provenance, snapshot health, and an explicit update check. - Refreshes the displayed counts automatically every 15 seconds and on window focus. - Fixes the reviewed Cloud publication workflow so an unrelated main-branch change (for example README documentation) is rebased automatically rather than causing `needs_resolution`. - Continues to fail closed when the canonical `global-cloud/**` base actually changed.  ## Public/private boundary  This PR contains regular-user UI and neutral release-infrastructure changes only. It contains no Admin UI, Admin service, credentials, private prompts, or local paths.  ## Verification  - Public frontend: 6 files, 10 tests passed - TypeScript check passed - Production Vite build passed - Workflow YAML parsed successfully - Local Git simulation proved a data-only reviewed commit rebases across a disjoint README commit while retaining a `global-cloud/**`-only diff

- **Issue #38** (2026-08-22): **Clarify v1.4.1 launch snapshot counts**
  *Symptoms*: Documentation-only follow-up to #37.  The v1.4.1 README table records the schema-v2 launch snapshot, while the reviewed Global Cloud continues to grow through data-only releases. This change labels the table accordingly and links readers to the latest verified release for live counts.  No application, Cloud data, workflow, or Admin source changes are included.

- **Issue #37** (2026-08-22): **Principia v1.4.1: Meta-Principle foundation and unified research workspace**
  *Symptoms*: ## Summary  Publishes the latest Principia v1.4.1 regular-user experience as one consolidated public release:  - replaces the fragmented v1.4 workflow with the unified New Research workspace; - adds the scalable Sigma.js/Graphology WebGL Principles map, durable projects and sessions, semantic Global search, explicit Local extraction, scientific-text rendering, and virtual Principle/connection tools; - introduces the public Global Cloud schema v2 foundation with 958 Works, 676 literature Principles, 405 active Meta-Principles, 2,101 provenance links, 468 relations, and explicit foundation assessments; - removes privileged Cloud-maintenance implementation and routes from the public v1.4.1 source and distributions; - rewrites the root and core READMEs around the current v1.4.1 product while preserving the v1.3.3 section; - adds the two August 23 product screenshots with repository-relative GitHub paths; - hardens the v1-to-v2 release transition so it publishes one verified full snapshot instead of attempting an invalid cross-schema delta; - prevents redundant branch-push CI runs, reducing duplicate Actions notifications.  ## Local verification  - Global Cloud schema v2 validation: valid - Canonical content digest: `edc4173d496b54f36f43629590f4e2096ec48a699e9890f5cf60a3781ec23f67` - Deterministic release snapshots: byte-for-byte equal - Live v1 snapshot → v2 transition: full snapshot only, no invalid delta - Backend: 399 passed, 2 expected skips - Frontend: 8 passed - TypeScript 

- **Issue #21** (2026-08-14): **Global Cloud reviewed sync sync:01KZZF9ZJWBEPRKMYQSBGAN5TT**
  *Symptoms*: 

- **Issue #20** (2026-08-13): **Show direct checked PR handoff for SSH Admin publication**
  *Symptoms*: When Admin is configured with only the authorized SSH key, publication now exposes a direct prefilled GitHub compare/PR URL instead of appearing stuck while no GitHub API credential is available.

- **Issue #19** (2026-08-13): **Clarify SSH publication and pending Admin syncs**
  *Symptoms*: Keeps SSH publication explicitly resumable while its checked PR is being created, and counts only active/conflicted syncs as pending on the Dashboard. Adds regression coverage.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `59c0c36e` (2026-09-08)
**Commit Message**: fix: Cross-platform compatibility && Page Display

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -37,3 +37,6 @@ legacy/v1.2/data/*.sqlite-*
 legacy/v1.2/data/server-*.log
 legacy/v1.2/data/store.json
 legacy/v1.2/data/store.legacy.json
+
+principia-workspace/
+.history/
\ No newline at end of file
```

**File**: `Principia-v1.4.2/core-v1.4.2/frontend/src/components/ResearchGraph.tsx` (modified, +31/-12)
```diff
@@ -227,6 +227,12 @@ export function ResearchGraph({
       style: { pointerEvents: "none" },
     });
     const titleContext = titleCanvas.getContext("2d");
+    // Virtual links sit behind node circles, while titles remain above them.
+    const virtualCanvas = renderer.createCanvas("virtual-connections", {
+      beforeLayer: "nodes",
+      style: { pointerEvents: "none" },
+    });
+    const virtualContext = virtualCanvas.getContext("2d");
     let dragged = "";
     let dragStart = { x: 0, y: 0 };
     let dragDistance = 0;
@@ -469,8 +475,10 @@ export function ResearchGraph({
     });
     const titleBuffer = document.createElement("canvas");
     const bufferContext = titleBuffer.getContext("2d");
+    const virtualBuffer = document.createElement("canvas");
+    const virtualBufferContext = virtualBuffer.getContext("2d");
     const drawEmbeddedTitles = () => {
-      if (!titleContext) return;
+      if (!titleContext || !virtualContext || !virtualBufferContext) return;
       const dimensions = renderer.getDimensions();
       const requestedPixelRatio = Math.max(1, window.devicePixelRatio || 1);
       if (
@@ -492,6 +500,14 @@ export function ResearchGraph({
       const pixelRatio = titleCanvas.width / Math.max(1, dimensions.width);
       bufferContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
       bufferContext.clearRect(0, 0, dimensions.width, dimensions.height);
+      for (const canvas of [virtualCanvas, virtualBuffer]) {
+        if (canvas.width !== titleCanvas.width) canvas.width = titleCanvas.width;
+        if (canvas.height !== titleCanvas.height) canvas.height = titleCanvas.height;
+      }
+      virtualCanvas.style.width = `${dimensions.width}px`;
+      virtualCanvas.style.height = `${dimensions.height}px`;
+      virtualBufferContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
+      virtualBufferContext.clearRect(0, 0, dimensions.width, dimensions.height);
       const ratio = renderer.getCamera().getState().ratio;
       const itemCount = graph.order;
       const titleBudget =
@@ -515,17 +531,17 @@ export function ResearchGraph({
           continue;
         const from = renderer.framedGraphToViewport(sourceData);
         const to = renderer.framedGraphToViewport(targetData);
-        bufferContext.save();
-        bufferContext.beginPath();
-        bufferContext.moveTo(from.x, from.y);
-        bufferContext.lineTo(to.x, to.y);
-        bufferContext.setLineDash([9, 7]);
-        bufferContext.strokeStyle = "rgba(210,98,239,.92)";
-        bufferContext.lineWidth = 2.5;
-        bufferContext.shadowColor = "rgba(210,98,239,.45)";
-        bufferContext.shadowBlur = 5;
-        bufferContext.stroke();
-        bufferContext.restore();
+        virtualBufferContext.save();
+        virtualBufferContext.beginPath();
+        virtualBufferContext.moveTo(from.x, from.y);
+        virtualBufferContext.lineTo(to.x, to.y);
+        virtualBufferContext.setLineDash([9, 7]);
+        virtualBufferContext.strokeStyle = "rgba(210,98,239,.92)";
+        virtualBufferContext.lineWidth = 2.5;
+        virtualBufferContext.shadowColor = "rgba(210,98,239,.45)";
+        virtualBufferContext.shadowBlur = 5;
+        virtualBufferContext.stroke();
+        virtualBufferContext.restore();
       }
       for (const node of graph.nodes()) {
         const data = renderer.getNodeDisplayData(node);
@@ -636,6 +652,9 @@ export function ResearchGraph({
       titleContext.setTransform(1, 0, 0, 1, 0, 0);
       titleContext.clearRect(0, 0, titleCanvas.width, titleCanvas.height);
       titleContext.drawImage(titleBuffer, 0, 0);
+      virtualContext.setTransform(1, 0, 0, 1, 0, 0);
+      virtualContext.clearRect(0, 0, virtualCanvas.width, virtualCanvas.height);
+      virtualContext.drawImage(virtualBuffer, 0, 0);
     };
     renderer.on("afterRender", drawEmbeddedTitles);
     return () => {
```

**File**: `Principia-v1.4.2/core-v1.4.2/frontend/src/pages/ResearchWorkspaceFlow.test.tsx` (modified, +28/-0)
```diff
@@ -228,3 +228,31 @@ it('refreshes activity inventory while faster status polling continues', async (
   expect(mock.get.mock.calls.filter(call=>String(call[0]).endsWith('/status')).length).toBeGreaterThan(1);
   expect(within(dialog).getByText('old-model')).not.toBeNull();
 }, 10000);
+
+it('keeps generated hypotheses out of the connection studio without losing the principle draft', async () => {
+  const principles = ['one', 'two'].map(id => ({
+    principle_id: `prn:${id}`, record_kind: 'principle',
+    payload: { title: `Principle ${id}`, claim: `Measured ${id}` },
+  }));
+  mock.get.mockImplementation(async (path: string) => {
+    if (path === '/api/v1/providers') return { data: { profiles: [{ provider: 'siliconflow', configured: true, models: [] }] } };
+    if (path === '/api/v1/research-sessions') return { data: { items: [{ session_id: 'search', kind: 'research', state: 'succeeded' }] } };
+    if (path.endsWith('/{session_id}')) return { data: { session_id: 'search', state: 'succeeded', active_run: { state: 'succeeded', goal: 'Explore relationships' } } };
+    if (path.endsWith('/graph')) return { data: { revision: 1, items: principles } };
+    return { data: { items: [], sources: [], profiles: [] } };
+  });
+  mock.post.mockResolvedValue({ data: { items: [{ virtual_id: 'virtual:one', proposal: { title: 'Generated hypothesis', claim: 'A falsifiable connection' } }] } });
+  open('/research/search');
+  await screen.findByText('prn:one');
+  fireEvent.click(screen.getByRole('button', { name: 'Derive Principles' }));
+  fireEvent.click(screen.getByRole('button', { name: 'Add Principle one to selection' }));
+  fireEvent.click(screen.getByRole('button', { name: 'Add Principle two to selection' }));
+  fireEvent.click(screen.getByRole('button', { name: 'Derive virtual Principles' }));
+  await screen.findByText('Generated hypothesis');
+  fireEvent.click(screen.getByRole('button', { name: 'Derive connection' }));
+  expect(screen.queryByText('Generated hypothesis')).toBeNull();
+  expect(screen.queryByText('Virtual hypothesis')).toBeNull();
+  expect(screen.getByRole('button', { name: 'Manage Principles' }).textContent).toBe('Manage Principles');
+  fireEvent.click(screen.getByRole('button', { name: 'Derive Principles' }));
+  expect(screen.getByText('Generated hypothesis')).not.toBeNull();
+});
```

**File**: `Principia-v1.4.2/core-v1.4.2/frontend/src/pages/ResearchWorkspacePage.tsx` (modified, +19/-17)
```diff
@@ -4361,11 +4361,10 @@ export function ResearchWorkspacePage() {
         )
       ) : sessionId ? (
         <button
-          className="show-result-tray"
+          className={`show-result-tray${isDataProject ? "" : " manage-principles"}`}
           onClick={() => setTrayHidden(false)}
         >
-          {isDataProject ? "Study map" : "Results"}{" "}
-          <span>{isDataProject ? dataMapTotal : Number(trayPage.data?.total ?? 0)}</span>
+          {isDataProject ? <>Study map <span>{dataMapTotal}</span></> : "Manage Principles"}
         </button>
       ) : null}
 
@@ -4495,6 +4494,22 @@ export function ResearchWorkspacePage() {
           </div>
         )}
         <footer className="research-map-footer">
+          {sessionId ? (
+            <button
+              className="research-theme-toggle"
+              onClick={() =>
+                sendGraphOperations([
+                  {
+                    action: "theme",
+                    theme:
+                      sessionTheme === "daylight" ? "deep-space" : "daylight",
+                  },
+                ])
+              }
+            >
+              {sessionTheme === "daylight" ? "Starlight" : "Deep space"}
+            </button>
+          ) : null}
         <div className="research-map-legend" aria-label="Map legend">
           <span>
             <i className="ordinary" />
@@ -4563,19 +4578,6 @@ export function ResearchWorkspacePage() {
               >
                 Derive Principles
               </button>
-              <button
-                onClick={() =>
-                  sendGraphOperations([
-                    {
-                      action: "theme",
-                      theme:
-                        sessionTheme === "daylight" ? "deep-space" : "daylight",
-                    },
-                  ])
-                }
-              >
-                {sessionTheme === "daylight" ? "Starlight" : "Deep space"}
-              </button>
             </>
           ) : (
             <span>
@@ -5278,7 +5280,7 @@ export function ResearchWorkspacePage() {
               error={analyzeConnection.error ?? derivePrinciples.error}
             />
           ) : null}
-          {generatedPrinciples.map((item, index) => {
+          {studio === "principle" && generatedPrinciples.map((item, index) => {
             const proposal = record(item.proposal);
             const virtualId = text(item.virtual_id) || `virtual:${index}`;
             const candidateId = savedVirtualCandidates[virtualId] || "";
```

**File**: `Principia-v1.4.2/core-v1.4.2/frontend/src/styles.css` (modified, +11/-2)
```diff
@@ -9453,7 +9453,8 @@ body,
   background: rgba(8, 19, 36, 0.8);
   box-shadow: 0 16px 45px rgba(0, 0, 0, 0.3);
 }
-.research-graph-tools button {
+.research-graph-tools button,
+.research-theme-toggle {
   min-height: 36px;
   padding: 8px 12px;
   border-color: rgba(151, 192, 255, 0.25);
@@ -9462,10 +9463,18 @@ body,
   background: rgba(24, 45, 76, 0.78);
   font-size: 10px;
 }
-.research-graph-tools button:hover {
+.research-graph-tools button:hover,
+.research-theme-toggle:hover,
+.show-result-tray.manage-principles:hover {
   border-color: rgba(107, 205, 255, 0.62);
   background: rgba(34, 64, 101, 0.95);
 }
+.show-result-tray.manage-principles {
+  border-color: rgba(151, 192, 255, 0.25);
+  border-radius: 9px;
+  color: #dcecff;
+  background: rgba(24, 45, 76, 0.78);
+}
 .research-graph-tools span {
   padding: 7px 10px;
   color: #b8cce2;
```

**File**: `Principia-v1.4.2/core-v1.4.2/src/principia/data_discovery/sandbox.py` (modified, +10/-1)
```diff
@@ -5,7 +5,6 @@
 import json
 import os
 import re
-import resource
 import shutil
 import signal
 import site
@@ -18,6 +17,13 @@
 
 from ..cancellation import TaskCancelled, check_cancelled
 
+try:  # pragma: no cover - exercise differs on macOS/Linux
+    import resource
+    HAVE_RESOURCE = True
+except ImportError:  # pragma: no cover - Windows has no resource module
+    resource = None
+    HAVE_RESOURCE = False
+
 ALLOWED_IMPORTS = {
     "collections",
     "datetime",
@@ -229,6 +235,9 @@ def _sandbox_profile(self, *, artifact_root: Path, read_roots: list[Path]) -> st
         return "\n".join(rules)
 
     def _limits(self) -> None:
+        if not HAVE_RESOURCE:  # pragma: no cover - Windows sandbox is unavailable
+            return
+
         def set_soft(kind: int, value: int) -> None:
             _, hard = resource.getrlimit(kind)
             resource.setrlimit(kind, (min(value, hard), hard))
```

**File**: `Principia-v1.4.2/core-v1.4.2/src/principia/ui_dist/index.html` (modified, +15/-15)
```diff
@@ -1,17 +1,17 @@
-<!doctype html>
-<html lang="en">
-  <head>
-    <meta charset="UTF-8" />
-    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
-    <meta name="principia-session" content="__PRINCIPIA_SESSION__" />
-    <meta name="theme-color" content="#11111a" />
-    <title>Principia</title>
-    <script type="module" crossorigin src="/assets/index-OMJc_PRr.js"></script>
+<!doctype html>
+<html lang="en">
+  <head>
+    <meta charset="UTF-8" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="principia-session" content="__PRINCIPIA_SESSION__" />
+    <meta name="theme-color" content="#11111a" />
+    <title>Principia</title>
+    <script type="module" crossorigin src="/assets/index-CgT9lNvA.js"></script>
     <link rel="modulepreload" crossorigin href="/assets/react-D04oS3ui.js">
     <link rel="modulepreload" crossorigin href="/assets/query-CBnoGMQm.js">
-    <link rel="stylesheet" crossorigin href="/assets/index-CrZLlW5P.css">
-  </head>
-  <body>
-    <div id="root"></div>
-  </body>
-</html>
+    <link rel="stylesheet" crossorigin href="/assets/index-CABoO7lG.css">
+  </head>
+  <body>
+    <div id="root"></div>
+  </body>
+</html>
```

**File**: `README.md` (modified, +24/-2)
```diff
@@ -84,19 +84,41 @@ Open **Dataset & evidence** for each project's provenance and selection rational
 
 Use **Python 3.11 or 3.12** in a virtual environment. This is the GitHub source release; the commands below do not depend on a matching version being published to PyPI.
 
+**Download the application without the separate public test corpus.**
+
 ```bash
-# Download the application without the separate public test corpus.
 git clone --depth 1 --filter=blob:none --sparse https://github.com/pzqpzq/Principia.git
 cd Principia
 git sparse-checkout set Principia-v1.4.2
+```
 
+**For Linux or macOS**
+
+```bash
 python3 -m venv .venv
 source .venv/bin/activate
 python -m pip install "./Principia-v1.4.2/core-v1.4.2[asd,local]"
 principia open --working-directory ./principia-workspace --port 8142
 ```
 
-On Windows, activate with `.venv\Scripts\Activate.ps1` in PowerShell. The application opens at **http://127.0.0.1:8142/**. Its frontend is already built; Node.js is needed only for frontend development. Dependency installation requires internet access. Once installed, the five demos and their packaged evidence can be browsed offline; external publisher links and remote model calls require a connection.
+**For Windows**
+
+```bash
+python -m venv .venv
+.venv\Scripts\Activate.ps1
+python -m pip install "./Principia-v1.4.2/core-v1.4.2[asd,local]"
+principia open --working-directory ./principia-workspace --port 8142
+
+# for Windows users after frontend changes
+# If the frontend code has been modified, rebuild the frontend and reinstall the local package using the following commands:
+cd "Principia\Principia-v1.4.2\core-v1.4.2\frontend"
+pnpm build
+
+cd ..
+pip install -e .
+```
+
+The application opens at **http://127.0.0.1:8142/**. Its frontend is already built; Node.js is needed only for frontend development. Dependency installation requires internet access. Once installed, the five demos and their packaged evidence can be browsed offline; external publisher links and remote model calls require a connection.
 
 Demos initialize **once in an empty workspace**. Existing projects are preserved, and deleted demos do not reappear on restart. To try the included projects separately from existing work, choose a new working directory.
 
```

---

### Incident Patch 2: `ee66cd6d` (2026-09-07)
**Commit Message**: Present v1.4.2 with five demos, four screenshots and public scenario guide

**File**: `README.md` (modified, +131/-11)
```diff
@@ -1,27 +1,147 @@
 <h1 align="center">Principia</h1>
 
-<p align="center"><strong>The living Principles Cloud for Autonomous Scientific Discovery</strong></p>
-<p align="center"><em>From scientific works to reusable structure. From structure to testable derivations.</em></p>
+<p align="center"><strong>Autonomous Scientific Discovery, grounded in Principles and tested against data.</strong></p>
+<p align="center">Explore scientific knowledge. Discover interpretable Rules. Inspect the evidence.</p>
 
 <p align="center">
-  <a href="https://github.com/pzqpzq/Principia/tree/main/Principia-v1.4.1/core"><img alt="Principia v1.4.1" src="https://img.shields.io/badge/Principia-v1.4.1-111827?style=flat-square&amp;logo=github"></a>
-  <a href="https://pypi.org/project/principia-ai/"><img alt="PyPI stable" src="https://img.shields.io/pypi/v/principia-ai?style=flat-square&amp;logo=pypi&amp;logoColor=white&amp;label=PyPI%20stable"></a>
-  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4.1/core/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/v1.4.1%20core-MIT-0F766E?style=flat-square"></a>
-  <a href="https://arxiv.org/abs/2606.29354"><img alt="ICML 2026" src="https://img.shields.io/badge/ICML-2026-6D4AFF?style=flat-square"></a>
+  <a href="./Principia-v1.4.2/"><img alt="Principia v1.4.2 source release" src="https://img.shields.io/badge/Principia-v1.4.2-111827?style=flat-square&amp;logo=github"></a>
+  <a href="#five-projects-ready-to-explore"><img alt="Five included demo projects" src="https://img.shields.io/badge/demo_projects-5-0F766E?style=flat-square"></a>
+  <a href="./scenario/"><img alt="Twenty independent public scenarios" src="https://img.shields.io/badge/public_scenarios-20-2563EB?style=flat-square"></a>
+  <a href="./Principia-v1.4.2/core-v1.4.2/LICENSE"><img alt="MIT licensed application" src="https://img.shields.io/badge/code-MIT-0F766E?style=flat-square"></a>
+  <a href="https://arxiv.org/abs/2606.29354"><img alt="ICML 2026 research" src="https://img.shields.io/badge/ICML-2026-6D4AFF?style=flat-square"></a>
 </p>
 
 <p align="center">
+  <a href="#start-v142-locally">Quick start</a> ·
+  <a href="#five-projects-ready-to-explore">Included projects</a> ·
+  <a href="#from-local-data-to-an-inspectable-rule">Discovery workflow</a> ·
+  <a href="#twenty-independent-public-test-scenarios">Public scenarios</a> ·
   <a href="#principia-v141">v1.4.1</a> ·
-  <a href="#scientific-object-model">Object model</a> ·
-  <a href="#from-retrieval-to-derivation">Workflow</a> ·
-  <a href="#global-principles-cloud">Cloud</a> ·
-  <a href="#install-and-open-v141">Quick start</a> ·
-  <a href="#principia-v133--evidence-grounded-idea-discovery">v1.3.3</a> ·
   <a href="#research-foundations">Research</a>
 </p>
 
 ---
 
+# Principia v1.4.2
+
+**Bring a research goal and a local dataset. Principia connects scientific context with executable analysis to look for compact, interpretable relationships—and keeps the evidence behind each result available for inspection.**
+
+Version 1.4.2 brings dataset-native **Autonomous Scientific Discovery (ASD)** into the Principles workspace. Literature Principles provide scientific context; observations describe computed evidence; extracted Rules carry equations, calibration results, validation decisions, and a stated scope. A study map connects these objects so you can move from a promising relationship to the records that support it.
+
+The release includes **five completed public-data projects**, analyzed with **DeepSeek-V4-Pro**. Their saved maps, results, equations, and packaged evidence open locally without the original datasets or an API key. Connect your own data and models when you are ready to begin a new discovery.
+
+<p align="center">
+  <a href="./assets/screenshots-v1.4.2-sep7/main-page.png"><img src="./assets/screenshots-v1.4.2-sep7/main-page.png" alt="Principia v1.4.2 home: research goal input, scientific area filters, Principles map, and five projects in the sidebar" width="100%"></a>
+  <br><sub>A shared scientific workspace: explore Principles by area, enter a research goal, or return to a saved project.</sub>
+</p>
+
+## From local data to an inspectable Rule
+
+| Stage | What Principia does | What you can inspect |
+| :--- | :--- | :--- |
+| **Inventory & understand** | Reads supported files, profiles measurements, and connects variables with the research goal and scientific context. | Source inventory, formats, units, coverage, and interpretation. |
+| **Generate & evaluate** | Proposes candidate expressions, fits them on development data, and uses validation evidence to compare alternatives. | Executable expressions, fitted parameters, baselines, and candidate tests. |
+| **Challenge** | Applies recorded held-out checks and evidence gates before promoting an executable relationship. | Split definitions, errors, controls, failure reasons, and limits of applicability. |
+| **Synthesize & explore** | Presents supported Rules alongside o
```

---

### Incident Patch 3: `bacb8dbc` (2026-08-17)
**Commit Message**: Fix README screenshot rendering

**File**: `README.md` (modified, +1/-3)
```diff
@@ -48,9 +48,7 @@ python -m pip install principia-ai==1.4.1
 principia open --working-directory ./principia-project
 ```
 
-<p align="center">
-  <img src="./assets/screenshots-v1.4.1/principles_map.png" alt="Principia v1.4.1 Principles Map" width="100%">
-</p>
+[![Principia v1.4.1 Principles Map](assets/screenshots-v1.4.1/principles-map.jpg)](assets/screenshots-v1.4.1/principles-map.jpg)
 
 > **Principia is a continuously maintained Principles Cloud, not a static collection of paper summaries.**
 >
```

---

### Incident Patch 4: `58c0693f` (2026-08-14)
**Commit Message**: Fix Global Cloud publication completion polling

**File**: `Principia-v1.4.1/core/src/principia/admin/github.py` (modified, +29/-4)
```diff
@@ -257,12 +257,37 @@ def _verified_release_status(self, expected_commit: str) -> dict[str, Any]:
             if str(compare.get("status") or "") not in {"ahead", "identical"}:
                 return {"state": "release_building", "error": {}}
         release_id = str(latest.get("release_id") or "")
-        release = self._status_request(
-            f"/repos/{self.repository}/releases/tags/global-{release_id}"
+        snapshot_digest = str(latest.get("snapshot_sha256") or "")
+        if not release_id or len(snapshot_digest) != 64:
+            return {"state": "release_building", "error": {}}
+
+        # The public release downloads are the client contract. Verify them
+        # directly instead of depending on GitHub's rate-limited REST API;
+        # SSH-only Admin installations intentionally have no API token.
+        release_root = (
+            f"https://github.com/{self.repository}/releases/download/global-{release_id}"
         )
-        asset_names = {str(item.get("name") or "") for item in release.get("assets") or []}
+        try:
+            manifest_response = httpx.get(
+                f"{release_root}/manifest.json", timeout=20, follow_redirects=True
+            )
+            sums_response = httpx.get(
+                f"{release_root}/SHA256SUMS", timeout=20, follow_redirects=True
+            )
+            if manifest_response.status_code != 200 or sums_response.status_code != 200:
+                return {"state": "release_building", "error": {}}
+            release_manifest = manifest_response.json()
+            sums = sums_response.text.splitlines()
+        except (ValueError, httpx.HTTPError):
+            return {"state": "release_building", "error": {}}
+
+        if not isinstance(release_manifest, dict):
+            return {"state": "release_building", "error": {}}
+        for key in ("release_id", "commit_sha", "content_digest", "snapshot_sha256"):
+            if str(release_manifest.get(key) or "") != str(latest.get(key) or ""):
+                return {"state": "release_building", "error": {}}
         snapshot_name = f"principia-global-{release_id}.pcg"
-        if not {snapshot_name, "manifest.json", "SHA256SUMS"}.issubset(asset_names):
+        if f"{snapshot_digest}  {snapshot_name}" not in sums:
             return {"state": "release_building", "error": {}}
         return {"state": "published", "release_id": release_id, "error": {}}
 
```

**File**: `Principia-v1.4.1/core/tests/test_v141_admin_publication.py` (modified, +58/-21)
```diff
@@ -9,8 +9,9 @@
 class _Response:
     status_code = 200
 
-    def __init__(self, payload: dict[str, object]):
+    def __init__(self, payload: dict[str, object], *, text: str = ""):
         self._payload = payload
+        self.text = text
 
     def json(self) -> dict[str, object]:
         return self._payload
@@ -22,19 +23,19 @@ def test_followup_release_commit_completes_reviewed_publication(monkeypatch) ->
     release_sha = "b" * 40
     release_id = "20260813-followup"
 
-    def status(path: str) -> dict[str, object]:
-        if path.endswith("/pulls/14"):
-            return {"merged": True, "merge_commit_sha": merge_sha}
-        assert path.endswith(f"/releases/tags/global-{release_id}")
-        return {
-            "assets": [
-                {"name": f"principia-global-{release_id}.pcg"},
-                {"name": "manifest.json"},
-                {"name": "SHA256SUMS"},
-            ]
-        }
-
-    monkeypatch.setattr(GitHubPublicationAdapter, "_status_request", lambda _self, path: status(path))
+    snapshot_sha = "c" * 64
+    latest = {
+        "verified": True,
+        "commit_sha": release_sha,
+        "content_digest": "d" * 64,
+        "snapshot_sha256": snapshot_sha,
+        "release_id": release_id,
+    }
+    monkeypatch.setattr(
+        GitHubPublicationAdapter,
+        "_status_request",
+        lambda _self, path: {"merged": True, "merge_commit_sha": merge_sha},
+    )
     monkeypatch.setattr(
         GitHubPublicationAdapter,
         "compare_commits",
@@ -44,13 +45,12 @@ def status(path: str) -> dict[str, object]:
         github_module,
         "httpx",
         SimpleNamespace(
-            get=lambda *_args, **_kwargs: _Response(
-                {
-                    "verified": True,
-                    "commit_sha": release_sha,
-                    "release_id": release_id,
-                }
-            )
+            HTTPError=RuntimeError,
+            get=lambda url, *_args, **_kwargs: (
+                _Response(latest, text=f"{snapshot_sha}  principia-global-{release_id}.pcg\n")
+                if str(url).endswith("latest.json") or str(url).endswith("SHA256SUMS")
+                else _Response(latest)
+            ),
         ),
     )
 
@@ -76,6 +76,7 @@ def test_unrelated_verified_release_does_not_complete_publication(monkeypatch) -
         github_module,
         "httpx",
         SimpleNamespace(
+            HTTPError=RuntimeError,
             get=lambda *_args, **_kwargs: _Response(
                 {
                     "verified": True,
@@ -89,6 +90,42 @@ def test_unrelated_verified_release_does_not_complete_publication(monkeypatch) -
     assert adapter.publication_status(pr_number=14)["state"] == "release_building"
 
 
+def test_exact_release_status_does_not_require_github_api(monkeypatch) -> None:
+    adapter = GitHubPublicationAdapter()
+    commit_sha = "e" * 40
+    release_id = "20260815-direct-controls"
+    snapshot_sha = "f" * 64
+    latest = {
+        "verified": True,
+        "commit_sha": commit_sha,
+        "content_digest": "a" * 64,
+        "snapshot_sha256": snapshot_sha,
+        "release_id": release_id,
+    }
+
+    def get(url: str, *_args, **_kwargs) -> _Response:
+        if url.endswith("SHA256SUMS"):
+            return _Response({}, text=f"{snapshot_sha}  principia-global-{release_id}.pcg\n")
+        return _Response(latest)
+
+    monkeypatch.setattr(
+        GitHubPublicationAdapter,
+        "_status_request",
+        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("REST API used")),
+    )
+    monkeypatch.setattr(
+        github_module,
+        "httpx",
+        SimpleNamespace(HTTPError=RuntimeError, get=get),
+    )
+
+    assert adapter._verified_release_status(commit_sha) == {
+        "state": "published",
+        "release_id": release_id,
+        "error": {},
+    }
+
+
 def test_reviewed_branch_reports_one_failed_publication_run(monkeypatch) -> None:
     adapter = GitHubPublicationAdapter()
     monkeypatch.setattr(
```

---

### Incident Patch 5: `e745ab57` (2026-08-14)
**Commit Message**: Fix Admin extraction relevance and recovery

**File**: `Principia-v1.4.1/core/frontend/src/pages/AdminPage.tsx` (modified, +15/-8)
```diff
@@ -15,7 +15,7 @@ const failureMessage = (paper: UnknownRecord): string => {
   if (text(error.message)) return text(error.message);
   if (paper.state === "acquisition_failed") return "Full text could not be acquired; abstracts are not used for Admin extraction.";
   if (paper.state === "provider_failed") return "The LLM request failed. Test the connection, then retry this paper.";
-  if (paper.state === "validation_quarantined") return "No extracted Principle passed the evidence checks.";
+  if (paper.state === "validation_quarantined") return "The model completed, but this paper contained no supported reusable finding for the goal. Repeating the same paper and model will not help.";
   if (paper.state === "cleanup_failed") return "Temporary source cleanup failed; this paper cannot be marked successful.";
   return "";
 };
@@ -74,6 +74,10 @@ export function AdminPage() {
     mutationFn: async () => dataOrThrow(await api.POST("/api/v1/admin/campaigns", { body: { research_goal: goal, target_count: targetCount, provider_profile_id: providerProfile, model, concurrency } })),
     onSuccess: (value) => { setCampaignId(text(value.campaign_id)); setTab("Discover"); queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }); },
   });
+  const rediscoverBetter = useMutation({
+    mutationFn: async () => dataOrThrow(await api.POST("/api/v1/admin/campaigns", { body: { research_goal: text(campaign?.research_goal), target_count: Number(campaign?.target_count || 50), provider_profile_id: campaignProvider, model: campaignModel, concurrency: Number(campaign?.concurrency || 4) } })),
+    onSuccess: (value) => { setCampaignId(text(value.campaign_id)); setSelectedWorks([]); setTab("Discover"); queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }); },
+  });
   const saveSelection = useMutation({ mutationFn: async () => dataOrThrow(await api.PATCH("/api/v1/admin/campaigns/{campaign_id}/selection", { params: { path: { campaign_id: campaignId } }, body: { work_ids: selectedWorks } })), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-papers"] }) });
   const extract = useMutation({ mutationFn: async () => { await saveSelection.mutateAsync(); return dataOrThrow(await api.POST("/api/v1/admin/campaigns/{campaign_id}/extract", { params: { path: { campaign_id: campaignId } }, body: { retry: false, egress_confirmed: true } })); }, onSuccess: () => { setTab("Extract"); queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }); } });
   const retryRecoverableFailures = useMutation({
@@ -149,6 +153,7 @@ export function AdminPage() {
   const publicationReady = Boolean(campaignId && acceptedRows.length && !undecidedClearRows.length);
   const dashboardCloud = record(dashboard.data?.cloud);
   const campaignState = text(campaign?.state);
+  const campaignDiscovery = record(campaign?.discovery);
   const provider = record((Array.isArray(providers.data?.profiles) ? providers.data.profiles : []).find((item) => text(record(item).provider_id) === providerProfile) ?? (Array.isArray(providers.data?.profiles) ? providers.data.profiles : [])[0]);
   const providerConfigured = Boolean(provider.configured);
   const campaignModel = text(campaign?.model) || model;
@@ -158,14 +163,15 @@ export function AdminPage() {
   const validationFailures = paperRows.filter((paper) => paper.state === "validation_quarantined").length;
   const stagedPapers = paperRows.filter((paper) => paper.state === "staged").length;
   const discovering = campaignState === "discovering" || createCampaign.isPending;
-  const extractablePaperIds = paperRows.filter((paper) => paper.availability_status === "available").map((paper) => text(paper.work_id)).filter(Boolean);
-  const metadataOnlyPapers = paperRows.length - extractablePaperIds.length;
+  const extractablePaperIds = paperRows.filter((paper) => paper.availability_status === "available" && paper.goal_relevant !== false).map((paper) => text(paper.work_id)).filter(Boolean);
+  const metadataOnlyPapers = paperRows.filter((paper) => paper.availability_status !== "available" && paper.goal_relevant !== false).length;
+  const offGoalPapers = paperRows.filter((paper) => paper.goal_relevant === false).length;
   const recoverablePaperIds = paperRows.filter((paper) => {
-    if (paper.availability_status !== "available") return false;
-    if (["provider_failed", "validation_quarantined"].includes(String(paper.state))) return true;
+    if (paper.availability_status !== "available" || paper.goal_relevant === false) return false;
+    if (paper.state === "provider_failed") return Boolean(record(paper.error).retryable ?? true);
     return paper.state === "acquisition_failed" && Boolean(record(paper.error).retryable);
   }).map((paper) => text(paper.work_id)).filter(Boolean);
-  const tabError = campaigns.error ?? providers.error ?? createCampaign.error ?? saveCredential.error ?? testCredential.error ?? (tab === "Dashboard" ? dashboard.error : null)
+  const tabError = campaigns.error ??
```

**File**: `Principia-v1.4.1/core/frontend/src/pages/LibraryPage.tsx` (modified, +20/-2)
```diff
@@ -38,6 +38,8 @@ export function LibraryPage() {
   const selectionInitialized = useRef(false);
   const openedRun = useRef("");
   const [manualWorkingDirectory, setManualWorkingDirectory] = useState("");
+  const [manualSourcePath, setManualSourcePath] = useState("");
+  const [sourcePathOpen, setSourcePathOpen] = useState(false);
   const [researchGoal, setResearchGoal] = useState("");
   const [selectedSources, setSelectedSources] = useState<string[]>([]);
   const [includeGlobalCloud, setIncludeGlobalCloud] = useState(true);
@@ -158,6 +160,21 @@ export function LibraryPage() {
       queryClient.invalidateQueries({ queryKey: ["goal-run-sources"] });
     },
   });
+  const addFolderPath = useMutation({
+    mutationFn: async () => {
+      const source = record(dataOrThrow(await api.POST("/api/v1/local/sources", { body: { path: manualSourcePath.trim() } })));
+      const sourceId = text(source.source_id);
+      if (sourceId) await dataOrThrow(await api.POST("/api/v1/local/sources/{source_id}/indexes", { params: { path: { source_id: sourceId } } }));
+      return source;
+    },
+    onSuccess: (value) => {
+      const sourceId = text(value.source_id);
+      if (sourceId) setSelectedSources((current) => Array.from(new Set([...current, sourceId])));
+      setManualSourcePath("");
+      setSourcePathOpen(false);
+      queryClient.invalidateQueries({ queryKey: ["goal-run-sources"] });
+    },
+  });
   const saveCredential = useMutation({
     mutationFn: async () => dataOrThrow(await api.PUT("/api/v1/provider-profiles/{provider_id}/credential", { params: { path: { provider_id: "siliconflow" } }, body: { api_key: credential } })),
     onSuccess: () => {
@@ -206,7 +223,7 @@ export function LibraryPage() {
     ? `${String(cloud.work_count ?? 0)} papers · ${String(cloud.principle_count ?? 0)} Principles`
     : "Offline — Local search still works";
   const primaryError = workingDirectory.error ?? chooseWorkingDirectory.error ?? switchWorkingDirectory.error
-    ?? addFolders.error ?? saveCredential.error ?? startGoalRun.error ?? goalRun.error ?? cancelGoalRun.error
+    ?? addFolders.error ?? addFolderPath.error ?? saveCredential.error ?? startGoalRun.error ?? goalRun.error ?? cancelGoalRun.error
     ?? startOnlineSearch.error ?? onlineSearch.error ?? acquireOnline.error ?? onlineAcquisitionJob.error;
   const onlineRows = (Array.isArray(onlineSearch.data?.results) ? onlineSearch.data.results : []).map(record);
 
@@ -226,7 +243,8 @@ export function LibraryPage() {
     <main className="goal-composer" aria-labelledby="goal-composer-title">
       <section className="goal-step sources-step">
         <header><span>1</span><div><h2 id="goal-composer-title">Choose your knowledge</h2><p>Local folders are optional. Add several at once or search only the Cloud.</p></div></header>
-        <div className="source-actions"><button className="primary quiet" onClick={() => addFolders.mutate()} disabled={addFolders.isPending}>{addFolders.isPending ? "Choose folders in the system dialog…" : "+ Add local folders"}</button><button onClick={() => { setOnlineQuestion(researchGoal); setOnlineOpen(true); }}>Find papers online</button></div>
+        <div className="source-actions"><button className="primary quiet" onClick={() => addFolders.mutate()} disabled={addFolders.isPending}>{addFolders.isPending ? "Choosing folders…" : "+ Add local folders"}</button><button onClick={() => setSourcePathOpen((current) => !current)}>Use a folder path</button><button onClick={() => { setOnlineQuestion(researchGoal); setOnlineOpen(true); }}>Find papers online</button></div>
+        {sourcePathOpen ? <form className="source-path-entry" onSubmit={(event) => { event.preventDefault(); addFolderPath.mutate(); }}><label htmlFor="home-local-folder-path">Existing local folder path</label><div className="input-action"><input id="home-local-folder-path" value={manualSourcePath} onChange={(event) => setManualSourcePath(event.target.value)} placeholder="/absolute/path/to/papers" autoFocus /><button className="primary" disabled={!manualSourcePath.trim() || addFolderPath.isPending}>{addFolderPath.isPending ? "Connecting…" : "Connect folder"}</button><button type="button" onClick={() => { setSourcePathOpen(false); setManualSourcePath(""); }}>Cancel</button></div><small>The folder stays where it is. Principia indexes its papers into this working directory.</small></form> : null}
         {sourceRows.length ? <div className="source-chip-list">{sourceRows.map((source) => <label key={source.source_id} className={selectedSources.includes(source.source_id) ? "source-chip selected" : "source-chip"}><input type="checkbox" checked={selectedSources.includes(source.source_id)} onChange={(event) => toggleSource(source.source_id, event.target.checked)} /><span><strong>{source.display_name}</strong><small>{source.status === "indexing" ? "Indexing papers…" : source.status === "index_failed" ? "Indexing needs attention" : `${source.document_count} paper${sourc
```

**File**: `Principia-v1.4.1/core/frontend/src/pages/MapPage.tsx` (modified, +17/-1)
```diff
@@ -49,6 +49,22 @@ function listValue(value: unknown): unknown[] {
   return Array.isArray(value) ? value : [];
 }
 
+function publicPaperUrl(value: ObjectValue): string {
+  for (const candidate of [value.source_url, value.landing_url, value.url, ...listValue(value.source_urls)]) {
+    const url = textValue(candidate).trim();
+    if (url.startsWith("https://")) return url;
+  }
+  const doi = textValue(value.doi).trim();
+  if (doi) return `https://doi.org/${doi}`;
+  const arxiv = textValue(value.arxiv_id).trim();
+  if (arxiv) return `https://arxiv.org/abs/${arxiv}`;
+  const pmid = textValue(value.pmid).trim();
+  if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
+  const pmcid = textValue(value.pmcid).trim();
+  if (pmcid) return `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcid}/`;
+  return "";
+}
+
 function countMap(value: unknown): { [key: string]: number } {
   const record = objectValue(value);
   return Object.fromEntries(Object.entries(record).map(([key, count]) => [key, Number(count) || 0]));
@@ -484,7 +500,7 @@ export function MapPage() {
         <section><h3>Boundary</h3><p>{listValue(argument.boundary).map(String).join("; ") || listValue(detailValue.boundary).map(String).join("; ") || "The reported boundary has not been projected into this view."}</p></section>
         <section><h3>How it can be tested</h3><p>{textValue(argument.testability, textValue(detailValue.testability, textValue(detailValue.falsifier, "Human review is required to define a test.")))}</p></section>
         <section><h3>Validated relations</h3>{relations.isLoading ? <LoadingState label="Reading validated relations…" /> : relationRows.length ? <ul className="relation-list">{relationRows.map((relation) => <li key={relation.relation_id}><button onClick={() => updateParams({ selected: relation.related_principle_id })}><span>{relation.orientation === "incoming" ? "Incoming" : "Outgoing"} · {relation.relation_type.replaceAll("_", " ")}</span><strong>{relation.related_title}</strong></button><span>{relation.rationale}</span></li>)}</ul> : <p>No validated scientific relation is available. Proposed or shared-paper links are intentionally excluded.</p>}</section>
-        <section><h3>Paper evidence</h3>{evidence.length ? <div className="evidence-cards">{evidence.map((item, index) => { const sourceUrl = textValue(item.source_url, textValue(item.url)); const quotation = textValue(item.quotation, textValue(item.excerpt)); return <article key={textValue(item.evidence_id, textValue(item.work_id, String(index)))}><strong>{textValue(item.work_title, textValue(item.title, "Supporting paper"))}</strong><small>{textValue(item.section)}{item.page_start ? ` · page ${String(item.page_start)}` : ""}</small>{quotation ? <blockquote>{quotation}</blockquote> : <p>Source text is not included in this portable package. The public paper link remains available.</p>}{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Open source paper ↗</a> : <span>Public paper link unavailable</span>}</article>; })}</div> : <p>No public paper reference is projected for this Principle.</p>}</section>
+        <section><h3>Paper evidence</h3>{evidence.length ? <div className="evidence-cards">{evidence.map((item, index) => { const sourceUrl = publicPaperUrl(item); const quotation = textValue(item.quotation, textValue(item.excerpt)); return <article key={textValue(item.evidence_id, textValue(item.work_id, String(index)))}><strong>{textValue(item.work_title, textValue(item.title, "Supporting paper"))}</strong><small>{textValue(item.section)}{item.page_start ? ` · page ${String(item.page_start)}` : ""}</small>{quotation ? <blockquote>{quotation}</blockquote> : <p>Source text is not included in this portable package. The public paper link remains available.</p>}{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Open source paper ↗</a> : <span>Public paper link unavailable</span>}</article>; })}</div> : <p>No public paper reference is projected for this Principle.</p>}</section>
         <details className="technical-record"><summary>Technical record</summary><pre>{JSON.stringify({ detail: detailValue, relations: relationRows, metric_revision: selectedCard?.metric_revision }, null, 2)}</pre></details>
         {selectedCard?.source === "local" ? <section className="principle-management"><h3>Manage this Principle</h3><p>Rename changes only the display title. Archiving hides the Principle without deleting its evidence or audit history.</p>{editingTitle ? <form onSubmit={(event) => { event.preventDefault(); editPrinciple.mutate(); }}><input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} /><button className="primary" disabled={editingTitle.trim().length < 3}>Save title</button><button type="button" onClick={() => setEditingTitle("")}>Cancel</button></form> : <div><button onClick={() => setEditingTitle(textValue(detailValue.title, selectedCard.title))}>Rename</button>{selectedCard.evidence_st
```

**File**: `Principia-v1.4.1/core/frontend/src/styles.css` (modified, +1/-0)
```diff
@@ -665,6 +665,7 @@ dd { margin: 3px 0 0; font-weight: 650; font-size: 12px; }
 /* Concise v1.4.1 goal workflow */
 .concise-library{max-width:1120px;margin:0 auto}.concise-library .page-header{margin-bottom:18px}.concise-library .page-header h1{font-size:34px}.workspace-strip{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:11px}.workspace-strip>div{display:flex;align-items:center;gap:8px;min-width:0;margin-right:auto}.workspace-strip>div>span:not(.status-dot){color:var(--muted)}.workspace-strip button{padding:6px 10px}.workspace-strip details{position:relative}.workspace-strip details>summary{color:var(--muted);cursor:pointer;font-size:10px}.workspace-strip details form{position:absolute;z-index:12;right:0;top:28px;width:460px;display:flex;gap:7px;padding:10px;border:1px solid var(--line);border-radius:10px;background:#fff;box-shadow:var(--shadow)}
 .goal-composer{display:grid;gap:12px}.goal-step,.goal-progress{padding:22px 24px;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 5px 20px rgba(40,37,62,.035)}.goal-step>header{display:flex;gap:13px;align-items:flex-start;margin-bottom:17px}.goal-step>header>span{display:grid;place-items:center;width:28px;height:28px;flex:0 0 auto;border-radius:50%;background:var(--violet);color:#fff;font-weight:800}.goal-step>header h2{margin:2px 0 3px;font-size:19px}.goal-step>header p{margin:0;color:var(--muted);font-size:11px}.source-actions{display:flex;gap:8px;margin-bottom:12px}.source-actions .quiet{background:var(--violet-soft);border-color:#d7d0ff;color:var(--violet-dark)}.source-chip-list{display:flex;gap:8px;flex-wrap:wrap}.source-chip{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#fafafd;cursor:pointer}.source-chip.selected{border-color:#cfc7ff;background:#f4f1ff}.source-chip input,.cloud-toggle input,.egress-confirm input{width:auto}.source-chip span,.source-chip strong,.source-chip small{display:block;margin:0}.source-chip strong{font-size:11px}.source-chip small{margin-top:2px;color:var(--muted);font-size:9px}.empty-inline{margin:0;color:var(--muted);font-size:11px}.question-step textarea{min-height:116px;padding:15px;font-size:15px;line-height:1.55}.cloud-toggle,.egress-confirm{display:flex;align-items:flex-start;gap:10px;margin-top:12px;padding:11px 12px;border:1px solid #dcd7f7;border-radius:10px;background:#faf9ff}.cloud-toggle span,.cloud-toggle strong,.cloud-toggle small,.egress-confirm span{display:block;margin:0}.cloud-toggle strong{font-size:11px}.cloud-toggle small{margin-top:2px;color:var(--muted);font-size:9px}.provider-setup{display:grid;grid-template-columns:minmax(230px,1fr) minmax(240px,1fr) auto;align-items:end;gap:10px;margin-top:12px;padding:13px;border:1px solid #ead9ad;border-radius:10px;background:#fffaf0}.provider-setup strong,.provider-setup small{display:block}.provider-setup strong{font-size:11px}.provider-setup small{margin-top:3px;color:#79694c;font-size:9px}.egress-confirm{border-color:#d8eadf;background:#f5fbf8;font-size:10px;line-height:1.5}.inline-success{margin:9px 0 0;color:#237a59;font-size:10px}.goal-options{margin-top:12px}.goal-options>summary{cursor:pointer;color:var(--muted);font-size:10px}.goal-options>div{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-top:10px}.run-goal-button{width:100%;margin-top:15px;padding:14px 18px;border-color:var(--violet);background:var(--violet);color:#fff;font-size:14px;font-weight:750}.run-goal-button:hover:not(:disabled){background:var(--violet-dark);color:#fff}.run-helper{display:block;margin-top:7px;color:var(--muted);text-align:center}.goal-progress header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.goal-progress h2{margin-bottom:10px}.branch-progress-list{display:grid;gap:8px}.branch-progress-list>div{display:grid;grid-template-columns:10px 120px 1fr;align-items:center;gap:9px;padding:10px;border-radius:9px;background:#f8f8fb}.branch-progress-list small{color:var(--muted)}.branch-state{display:block;width:8px;height:8px;border-radius:50%;background:#aaa}.branch-state.running{background:var(--violet);box-shadow:0 0 0 4px rgba(103,84,217,.12);animation:pulse 1.2s ease-in-out infinite}.branch-state.succeeded{background:var(--green)}.branch-state.failed{background:var(--red)}.recent-goals{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}.recent-goals>summary{display:flex;justify-content:space-between;color:var(--muted);cursor:pointer;font-size:11px}.recent-goals>div{display:grid;gap:6px;margin-top:9px}.recent-goals>div>button{display:flex;justify-content:space-between;align-items:center;text-align:left}.recent-goals strong,.recent-goals small{display:block}.recent-goals small{margin-top:3px;color:var(--muted);font-size:9px}
+.source-path-entry{display:grid;gap:7px;margin:-3px 0 12px;padding:12px;border:1px solid #d7d0ff;border-ra
```

**File**: `Principia-v1.4.1/core/src/principia/admin/github.py` (modified, +2/-2)
```diff
@@ -217,8 +217,8 @@ def review_branch_status(self, *, branch: str, commit_sha: str = "") -> dict[str
                     "error": {},
                 }
 
-        # Compatibility for batches submitted by v1.4.1 builds that still
-        # created a PR before the zero-touch workflow was installed.
+        # Compatibility for batches submitted by builds that still created a
+        # PR before the zero-touch workflow was installed.
         pulls = self._public_request(
             f"/repos/{self.repository}/pulls?state=all&head=pzqpzq:{branch}&per_page=10"
         )
```

**File**: `Principia-v1.4.1/core/src/principia/admin/ingestion.py` (modified, +150/-44)
```diff
@@ -3,6 +3,7 @@
 import hashlib
 import json
 import os
+import re
 import shutil
 import tempfile
 import threading
@@ -38,7 +39,12 @@
     monotonic_ulid,
     principle_id,
 )
-from ..local.literature import SafeLiteratureAcquirer, open_access_locations
+from ..local.literature import (
+    SafeLiteratureAcquirer,
+    goal_domain_relevance,
+    open_access_locations,
+)
+from ..local.literature_discovery import select_evidence_segments_for_goal
 from ..local.quality import ScientificQualityGate, stable_atom_id
 from ..models import WorkItem, utc_now
 from ..persistence import V14WorkspaceRepository
@@ -59,6 +65,35 @@
     "cancelled",
 }
 
+_AI_PHYSICS_AI = re.compile(
+    r"\b(?:ai|artificial intelligence|machine learning|ml)\b", re.IGNORECASE
+)
+_AI_PHYSICS_DOMAIN = re.compile(r"\bphysic(?:s|al)\b", re.IGNORECASE)
+
+
+def _admin_discovery_queries(goal: str, target_count: int) -> list[str]:
+    """Plan bounded scholarly queries without padding a precise goal with noise."""
+
+    queries = [goal]
+    if _AI_PHYSICS_AI.search(goal) and _AI_PHYSICS_DOMAIN.search(goal):
+        queries.extend(
+            [
+                "physics-informed machine learning",
+                "machine learning computational physics",
+                "machine learning quantum physics",
+                "machine learning particle physics",
+                "machine learning condensed matter physics",
+                "machine learning fluid physics simulation",
+                "machine learning plasma physics",
+                "machine learning astrophysics physical models",
+                "machine learning materials physics",
+            ]
+        )
+    minimum_rounds = max(1, min(400, (target_count + 49) // 50))
+    while len(queries) < minimum_rounds:
+        queries.append(f"{goal} research {len(queries) + 1}")
+    return list(dict.fromkeys(queries))
+
 
 def _diff(current: dict[str, Any], proposed: dict[str, Any]) -> dict[str, Any]:
     return {
@@ -166,25 +201,48 @@ def create(self, request: AdminCampaignRequest) -> dict[str, Any]:
 
     def _discover(self, campaign_id: str, request: AdminCampaignRequest) -> None:
         gathered: dict[str, dict[str, Any]] = {}
-        rounds = max(1, min(400, (request.target_count + 49) // 50))
         degraded: list[str] = []
-        for round_index in range(rounds):
+        queries = _admin_discovery_queries(request.research_goal, request.target_count)
+        for query_index, query in enumerate(queries, start=1):
             if len(gathered) >= request.target_count:
                 break
-            query = (
-                request.research_goal
-                if round_index == 0
-                else f"{request.research_goal} research {round_index + 1}"
-            )
             try:
                 page = self.local.search_papers(query, target_count=50, timeout=120)
                 for item in page.get("results") or []:
-                    gathered.setdefault(str(item["work_id"]), item)
+                    if goal_domain_relevance(request.research_goal, item):
+                        gathered.setdefault(str(item["work_id"]), item)
             except Exception as exc:
                 degraded.append(type(exc).__name__)
-                if not gathered:
-                    continue
-        works = list(gathered.values())[: request.target_count]
+            with self.repository.connect() as conn:
+                row = conn.execute(
+                    "SELECT payload_json FROM admin_campaigns WHERE campaign_id=?",
+                    (campaign_id,),
+                ).fetchone()
+                if row:
+                    progress_payload = json.loads(row[0])
+                    progress_payload["discovery"] = {
+                        "state": "searching",
+                        "queries_completed": query_index,
+                        "query_count": len(queries),
+                        "result_count": len(gathered),
+                        "extractable_count": sum(
+                            bool(item.get("oa_locations")) for item in gathered.values()
+                        ),
+                        "degraded_sources": sorted(set(degraded)),
+                    }
+                    conn.execute(
+                        "UPDATE admin_campaigns SET payload_json=?, updated_at=? "
+                        "WHERE campaign_id=?",
+                        (json.dumps(progress_payload, sort_keys=True), utc_now(), campaign_id),
+                    )
+        works = sorted(
+            gathered.values(),
+            key=lambda item: (
+                0 if item.get("oa_locations") else 1,
+                int(item.get("rank") or 0),
+                str(item.get("work_id") or ""),
+            ),
+        )[: request.target_count]
         with self.repository.connect() as conn:
             for rank, work in enumerate(works, start=1):
                 proposed = self._work_revision(work)
@@ -219,6 +277,8 @@ def _d
```

**File**: `Principia-v1.4.1/core/src/principia/cloud/snapshot.py` (modified, +16/-6)
```diff
@@ -89,7 +89,12 @@ def _decode_offset(cursor: str) -> int:
 
 
 def _public_work_url(work: dict[str, Any]) -> str:
-    """Project one durable public paper URL from a canonical Work record."""
+    """Project one durable public paper URL from a canonical Work record.
+
+    Canonical v1 Works use ``landing_url`` and ``source_urls`` while legacy
+    Explorer records used ``url``.  Keeping the projection here prevents UI
+    clients from having to understand every identifier representation.
+    """
 
     for key in ("source_url", "landing_url", "url"):
         value = str(work.get(key) or "").strip()
@@ -283,6 +288,9 @@ def sync(self, *, control_url: str | None = None, force: bool = False) -> dict[s
             headers = {"Accept": "application/json"}
             active_before_request = self.active()
             cached_release_id = str(state.get("release_id") or "")
+            # An ETag is valid only for the snapshot generation recorded with
+            # it.  If another process/test changed the active pointer, fetch
+            # the control document again so the verified release is restored.
             if (
                 not force
                 and state.get("etag")
@@ -411,12 +419,10 @@ def _connect(self) -> Any:
         return conn
 
     def canonical_records(self) -> dict[RecordKind, list[dict[str, Any]]]:
-        """Return the complete canonical record set from the verified snapshot.
+        """Return canonical payloads from the active verified snapshot.
 
-        Admin publication must extend the release that was actually reviewed,
-        never the possibly stale JSON fixtures bundled with the application.
-        Historical revisions are retained because all four snapshot tables
-        store their canonical payloads verbatim.
+        Admin publication extends the release that was actually reviewed,
+        never a potentially stale JSON fixture bundled with the application.
         """
 
         tables: dict[RecordKind, str] = {
@@ -670,6 +676,10 @@ def search(
             }
         if request.entity == "principle":
             return self._paper_first_principles(request, query_vector=query_vector)
+        # `all` is a single ranked result set, so its cursor must be applied
+        # after papers and Principles have been merged.  Applying the cursor
+        # independently to papers (and resetting it for Principles) duplicated
+        # rows on later pages and reported only the Principle subtotal.
         combined_limit = offset + request.limit
         paper_result = self.search(
             request.model_copy(
```

**File**: `Principia-v1.4.1/core/src/principia/local/literature.py` (modified, +13/-0)
```diff
@@ -159,6 +159,19 @@ def _domain_relevance(goal: str, item: dict[str, Any]) -> bool | None:
     return None
 
 
+def goal_domain_relevance(goal: str, item: dict[str, Any]) -> bool:
+    """Return whether an item satisfies any recognized multi-anchor goal.
+
+    Unrecognized goals remain permissive; recognized profiles such as
+    ``AI for Physics`` must satisfy both sides of the domain contract.  Admin
+    uses this public wrapper to revalidate saved campaigns created by older
+    retrieval code before allowing extraction or retry.
+    """
+
+    decision = _domain_relevance(goal, item)
+    return decision is not False
+
+
 def _relevance_terms(value: str) -> list[str]:
     value = re.sub(r"\bai\b", " artificial intelligence ai ", value, flags=re.IGNORECASE)
     value = re.sub(r"\bml\b", " machine learning ml ", value, flags=re.IGNORECASE)
```

---

### Incident Patch 6: `36f6ef01` (2026-08-14)
**Commit Message**: Fix AI for Physics Admin extraction

**File**: `Principia-v1.4.1/core/frontend/src/pages/AdminPage.tsx` (modified, +14/-8)
```diff
@@ -76,10 +76,10 @@ export function AdminPage() {
   });
   const saveSelection = useMutation({ mutationFn: async () => dataOrThrow(await api.PATCH("/api/v1/admin/campaigns/{campaign_id}/selection", { params: { path: { campaign_id: campaignId } }, body: { work_ids: selectedWorks } })), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-papers"] }) });
   const extract = useMutation({ mutationFn: async () => { await saveSelection.mutateAsync(); return dataOrThrow(await api.POST("/api/v1/admin/campaigns/{campaign_id}/extract", { params: { path: { campaign_id: campaignId } }, body: { retry: false, egress_confirmed: true } })); }, onSuccess: () => { setTab("Extract"); queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }); } });
-  const retryProviderFailures = useMutation({
+  const retryRecoverableFailures = useMutation({
     mutationFn: async () => {
-      const workIds = paperRows.filter((paper) => paper.state === "provider_failed").map((paper) => text(paper.work_id)).filter(Boolean);
-      if (!workIds.length) throw new Error("There are no LLM failures to retry.");
+      const workIds = recoverablePaperIds;
+      if (!workIds.length) throw new Error("There are no recoverable papers to retry.");
       await dataOrThrow(await api.PATCH("/api/v1/admin/campaigns/{campaign_id}/selection", { params: { path: { campaign_id: campaignId } }, body: { work_ids: workIds } }));
       return dataOrThrow(await api.POST("/api/v1/admin/campaigns/{campaign_id}/extract", { params: { path: { campaign_id: campaignId } }, body: { retry: true, egress_confirmed: true } }));
     },
@@ -158,10 +158,16 @@ export function AdminPage() {
   const validationFailures = paperRows.filter((paper) => paper.state === "validation_quarantined").length;
   const stagedPapers = paperRows.filter((paper) => paper.state === "staged").length;
   const discovering = campaignState === "discovering" || createCampaign.isPending;
-  const visiblePaperIds = paperRows.map((paper) => text(paper.work_id)).filter(Boolean);
+  const extractablePaperIds = paperRows.filter((paper) => paper.availability_status === "available").map((paper) => text(paper.work_id)).filter(Boolean);
+  const metadataOnlyPapers = paperRows.length - extractablePaperIds.length;
+  const recoverablePaperIds = paperRows.filter((paper) => {
+    if (paper.availability_status !== "available") return false;
+    if (["provider_failed", "validation_quarantined"].includes(String(paper.state))) return true;
+    return paper.state === "acquisition_failed" && Boolean(record(paper.error).retryable);
+  }).map((paper) => text(paper.work_id)).filter(Boolean);
   const tabError = campaigns.error ?? providers.error ?? createCampaign.error ?? saveCredential.error ?? testCredential.error ?? (tab === "Dashboard" ? dashboard.error : null)
     ?? (tab === "Discover" ? papers.error ?? saveSelection.error ?? extract.error : null)
-    ?? (tab === "Extract" ? extract.error ?? retryProviderFailures.error ?? pauseExtraction.error ?? resumeExtraction.error ?? cancelExtraction.error : null)
+    ?? (tab === "Extract" ? extract.error ?? retryRecoverableFailures.error ?? pauseExtraction.error ?? resumeExtraction.error ?? cancelExtraction.error : null)
     ?? (tab === "Review & Compare" ? staging.error ?? decision.error ?? bulkAdd.error : null)
     ?? (tab === "Publish" ? sync.error ?? createSync.error ?? submitSync.error : null);
 
@@ -217,16 +223,16 @@ export function AdminPage() {
         <details><summary>Extraction model</summary><div><label><span>Provider</span><input value={providerProfile} onChange={(event) => setProviderProfile(event.target.value)} /></label><label><span>Model</span><input value={model} onChange={(event) => setModel(event.target.value)} /></label><label><span>Workers</span><input type="number" min={4} max={8} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} /></label></div></details>
       </form>
       {campaignRows.length ? <div className="admin-campaign-picker"><label><span>Current search</span><select value={campaignId} onChange={(event) => { setCampaignId(event.target.value); setSelectedWorks([]); }}>{campaignRows.map((item) => <option key={text(item.campaign_id)} value={text(item.campaign_id)}>{text(item.research_goal)} · {text(item.state).replaceAll("_", " ")}</option>)}</select></label></div> : null}
-      {campaignId ? <div className={`discovery-status ${discovering ? "running" : "ready"}`} role="status"><span className="branch-state" aria-hidden="true" /><div><strong>{discovering ? "Retrieving and enriching public papers…" : `${Number(papers.data?.total ?? paperRows.length)} papers ready`}</strong><small>{discovering ? "Results will appear here as soon as discovery finishes." : "Choose at least four papers, then start extraction."}</small></div></div> : null}
+      {campaignId ? <div className={`discovery-status ${discovering ? "running" : "ready"}`} role="status"><span className="branch-state" aria-hidde
```

**File**: `Principia-v1.4.1/core/src/principia/admin/ingestion.py` (modified, +74/-4)
```diff
@@ -382,6 +382,23 @@ def select(self, campaign_id: str, work_ids: list[str]) -> dict[str, Any]:
                 )
                 if found != len(set(work_ids)):
                     raise ValueError("selection contains an unknown campaign Work")
+                unavailable = conn.execute(
+                    f"SELECT metadata_json, availability_status FROM admin_campaign_works "
+                    f"WHERE campaign_id=? AND work_id IN ({placeholders}) "
+                    "AND availability_status!='available' ORDER BY rank",
+                    (campaign_id, *work_ids),
+                ).fetchall()
+                if unavailable:
+                    titles = [
+                        str(json.loads(row["metadata_json"]).get("title") or "Untitled paper")
+                        for row in unavailable[:3]
+                    ]
+                    suffix = "" if len(unavailable) <= 3 else f" and {len(unavailable) - 3} more"
+                    raise ValueError(
+                        "Admin extraction is full-text-only. Remove metadata-only papers: "
+                        + "; ".join(titles)
+                        + suffix
+                    )
                 conn.execute(
                     f"UPDATE admin_campaign_works SET selected=1 WHERE campaign_id=? AND work_id IN ({placeholders})",
                     (campaign_id, *work_ids),
@@ -394,7 +411,8 @@ def extract(self, campaign_id: str, request: AdminExtractRequest) -> dict[str, A
             raise KeyError(campaign_id)
         with self.repository.connect() as conn:
             rows = conn.execute(
-                "SELECT work_id FROM admin_campaign_works WHERE campaign_id=? AND selected=1 "
+                "SELECT work_id, availability_status FROM admin_campaign_works "
+                "WHERE campaign_id=? AND selected=1 "
                 "AND state NOT IN ('staged') ORDER BY rank",
                 (campaign_id,),
             ).fetchall()
@@ -403,6 +421,12 @@ def extract(self, campaign_id: str, request: AdminExtractRequest) -> dict[str, A
             raise ValueError("a new Admin extraction requires at least four selected papers")
         if not work_ids:
             raise ValueError("no selected papers remain to extract")
+        metadata_only = [str(row[0]) for row in rows if str(row[1]) != "available"]
+        if metadata_only:
+            raise ValueError(
+                f"{len(metadata_only)} selected paper(s) have no verified full text. "
+                "Clear them before extraction; abstracts are never used as a fallback."
+            )
         if not request.egress_confirmed:
             raise ValueError("Admin LLM extraction requires explicit remote-egress confirmation")
         connection = self.local.test_provider_connection(campaign["provider_profile_id"])
@@ -716,6 +740,7 @@ def _process_work(
             decisions = {item.argument_index: item for item in challenges.decisions}
             self._set_unit(job_id, unit_id, work_id, "validating", campaign_id)
             valid = []
+            quality_reason_counts: dict[str, int] = {}
             for index, argument in enumerate(arguments.arguments):
                 reasons = gate.validate_argument(
                     argument,
@@ -724,6 +749,17 @@ def _process_work(
                     goal=(self._campaign_row(campaign_id) or {})["research_goal"],
                 )
                 decision = decisions.get(index)
+                for reason in reasons:
+                    key = reason.value
+                    quality_reason_counts[key] = quality_reason_counts.get(key, 0) + 1
+                if decision is None:
+                    quality_reason_counts["challenge_missing"] = (
+                        quality_reason_counts.get("challenge_missing", 0) + 1
+                    )
+                elif decision.verdict != "supported":
+                    for reason in decision.reason_codes:
+                        key = f"challenge:{reason.value}"
+                        quality_reason_counts[key] = quality_reason_counts.get(key, 0) + 1
                 if not reasons and decision and decision.verdict == "supported":
                     valid.append(argument)
             self._set_unit(job_id, unit_id, work_id, "staging", campaign_id)
@@ -745,7 +781,8 @@ def _process_work(
             work_record["content_digest"] = canonical_sha256(
                 {key: value for key, value in work_record.items() if key != "content_digest"}
             )
-            self._stage(campaign_id, work_id, "work", work_record)
+            if valid:
+                self._stage(campaign_id, work_id, "work", work_record)
             for argument in valid:
                 selected_atoms = [atom for atom in atoms if atom.atom_id in argument.atom_ids]
                 proposal = PrincipleRevision(
@@ -807,6 +844,24 @@ def _process_work(
                     self._stage(campaign_id, work_id, "principle_work", link)
             if not valid:
      
```

**File**: `Principia-v1.4.1/core/src/principia/local/literature.py` (modified, +27/-1)
```diff
@@ -66,6 +66,21 @@
 _RELEVANCE_WORD = re.compile(r"[a-z0-9]+", flags=re.IGNORECASE)
 
 _DOMAIN_RELEVANCE_PROFILES: list[tuple[re.Pattern[str], re.Pattern[str]]] = [
+    (
+        re.compile(
+            r"(?=.*\b(?:AI|artificial intelligence|machine learning|ML)\b)"
+            r"(?=.*\bphysic(?:s|al)\b)",
+            re.IGNORECASE | re.DOTALL,
+        ),
+        re.compile(
+            r"(?=.*\b(?:AI|artificial intelligence|machine learning|deep learning|"
+            r"neural networks?|data[- ]driven|foundation models?)\b)"
+            r"(?=.*\b(?:physic(?:s|al)|quantum|particle|fluid|molecular|materials?|"
+            r"climate|weather|optical|geophysic(?:s|al)|astronom(?:y|ical)|"
+            r"cosmolog(?:y|ical))\b)",
+            re.IGNORECASE | re.DOTALL,
+        ),
+    ),
     (
         re.compile(
             r"\bhilbert(?:'s|s)?\s+sixth\s+problem\b|"
@@ -145,6 +160,8 @@ def _domain_relevance(goal: str, item: dict[str, Any]) -> bool | None:
 
 
 def _relevance_terms(value: str) -> list[str]:
+    value = re.sub(r"\bai\b", " artificial intelligence ai ", value, flags=re.IGNORECASE)
+    value = re.sub(r"\bml\b", " machine learning ml ", value, flags=re.IGNORECASE)
     terms: list[str] = []
     for raw in _RELEVANCE_WORD.findall(value.casefold()):
         if len(raw) < 3 or raw in _RELEVANCE_STOPWORDS:
@@ -182,6 +199,15 @@ def rank_literature_for_goal(goal: str, items: list[dict[str, Any]]) -> list[dic
     source ranking as a stable tie-break while suppressing those false friends.
     """
 
+    # Broad scholarly providers frequently interpret the short query
+    # "AI for Physics" as either generic AI or generic physics.  For this
+    # recognized two-anchor goal, returning fewer genuinely relevant papers is
+    # safer than padding an Admin campaign with unrelated policy/education
+    # records that can never yield goal-relevant Principles.
+    ai_physics_goal = bool(_DOMAIN_RELEVANCE_PROFILES[0][0].search(goal))
+    if ai_physics_goal:
+        items = [item for item in items if _domain_relevance(goal, item) is True]
+
     goal_terms = set(_relevance_terms(goal))
     if not goal_terms or not items:
         return items
@@ -194,7 +220,7 @@ def rank_literature_for_goal(goal: str, items: list[dict[str, Any]]) -> list[dic
     }
     total = len(items)
 
-    hilbert_sixth_goal = bool(_DOMAIN_RELEVANCE_PROFILES[0][0].search(goal))
+    hilbert_sixth_goal = bool(_DOMAIN_RELEVANCE_PROFILES[1][0].search(goal))
 
     def score(item: dict[str, Any]) -> float:
         title_terms = set(_relevance_terms(str(item.get("title") or "")))
```

**File**: `Principia-v1.4.1/core/src/principia/local/quality.py` (modified, +24/-1)
```diff
@@ -118,6 +118,12 @@
 
 def _goal_terms(value: str) -> set[str]:
     normalized = value.casefold()
+    # Preserve short scientific acronyms before the generic length filter.
+    # Without this expansion, a goal such as "AI for Physics" contains only
+    # one usable term ("physics") and the old two-term overlap rule becomes
+    # mathematically impossible to satisfy.
+    normalized = re.sub(r"\bai\b", " artificial intelligence ai ", normalized)
+    normalized = re.sub(r"\bml\b", " machine learning ml ", normalized)
     normalized = re.sub(r"α\s*(?=pd[- ]?(?:1|l1))", "", normalized)
     normalized = re.sub(r"\bpd[- ]?l1\b", " pdl1 ", normalized)
     normalized = re.sub(r"\bpd[- ]?1\b", " pd1 ", normalized)
@@ -146,6 +152,22 @@ def _goal_profile(goal: str, argument_text: str) -> tuple[bool, bool, int]:
     goal_folded = goal.casefold()
     argument_folded = argument_text.casefold()
     profiles: list[tuple[re.Pattern[str], re.Pattern[str], int]] = [
+        (
+            re.compile(
+                r"(?=.*\b(?:ai|artificial intelligence|machine learning|ml)\b)"
+                r"(?=.*\bphysic(?:s|al)\b)",
+                re.DOTALL,
+            ),
+            re.compile(
+                r"(?=.*\b(?:ai|artificial intelligence|machine learning|deep learning|"
+                r"neural networks?|data[- ]driven|foundation models?)\b)"
+                r"(?=.*\b(?:physic(?:s|al)|quantum|particle|fluid|molecular|materials?|"
+                r"climate|weather|optical|geophysic(?:s|al)|astronom(?:y|ical)|"
+                r"cosmolog(?:y|ical))\b)",
+                re.DOTALL,
+            ),
+            1,
+        ),
         (
             re.compile(r"\bhilbert(?:'s|s)?\s+sixth\s+problem\b"),
             re.compile(
@@ -260,8 +282,9 @@ def validate_argument(
         goal_terms = _goal_terms(goal)
         argument_terms = _goal_terms(argument_text)
         _, missing_goal_anchor, minimum_goal_overlap = _goal_profile(goal, argument_text)
+        required_overlap = min(minimum_goal_overlap, len(goal_terms))
         if goal_terms and (
-            len(goal_terms.intersection(argument_terms)) < minimum_goal_overlap
+            len(goal_terms.intersection(argument_terms)) < required_overlap
             or missing_goal_anchor
         ):
             reasons.append(QualityReason.OFF_GOAL)
```

**File**: `Principia-v1.4.1/core/src/principia/ui_dist/index.html` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
     <meta name="principia-session" content="__PRINCIPIA_SESSION__" />
     <meta name="theme-color" content="#11111a" />
     <title>Principia</title>
-    <script type="module" crossorigin src="/assets/index-DoZH2ela.js"></script>
+    <script type="module" crossorigin src="/assets/index-DJZC-5YB.js"></script>
     <link rel="modulepreload" crossorigin href="/assets/query-CNrriFxR.js">
     <link rel="stylesheet" crossorigin href="/assets/index-s89RWB8x.css">
   </head>
```

**File**: `Principia-v1.4.1/core/tests/test_v141_admin_contract.py` (modified, +55/-0)
```diff
@@ -43,6 +43,61 @@ def test_admin_extract_requires_four_for_new_run(tmp_path: Path) -> None:
         app.close()
 
 
+def test_admin_selection_rejects_metadata_only_papers(tmp_path: Path) -> None:
+    app = AdminWorkspace.open(working_directory=tmp_path / "admin")
+    try:
+        service = app.admin_campaigns
+        assert service is not None
+        now = "2026-08-14T00:00:00Z"
+        with app.repository.connect() as conn:
+            conn.execute(
+                "INSERT INTO admin_campaigns VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
+                ("campaign:metadata-only", None, None, "discovery_ready", "AI for Physics", 1,
+                 "", "", "", "{}", '{"research_goal":"AI for Physics"}', now, now),
+            )
+            conn.execute(
+                "INSERT INTO admin_campaign_works VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
+                ("campaign:metadata-only", "work:metadata-only", 0, 0, "discovered",
+                 "unknown", "", None, "", "new",
+                 '{"title":"Abstract-only AI policy paper"}', "{}", None, ""),
+            )
+        with pytest.raises(ValueError, match="full-text-only"):
+            service.select("campaign:metadata-only", ["work:metadata-only"])
+    finally:
+        app.close()
+
+
+def test_admin_work_staging_is_idempotent_for_retry(tmp_path: Path) -> None:
+    app = AdminWorkspace.open(working_directory=tmp_path / "admin")
+    try:
+        service = app.admin_campaigns
+        assert service is not None
+        now = "2026-08-14T00:00:00Z"
+        with app.repository.connect() as conn:
+            conn.execute(
+                "INSERT INTO admin_campaigns VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
+                ("campaign:retry", None, None, "review_ready", "AI for Physics", 1,
+                 "", "", "", "{}", '{"research_goal":"AI for Physics"}', now, now),
+            )
+        first = service._stage(
+            "campaign:retry", "W-RETRY", "work",
+            {"work_id": "W-RETRY", "revision": 1, "title": "AI for Physics"},
+        )
+        second = service._stage(
+            "campaign:retry", "W-RETRY", "work",
+            {"work_id": "W-RETRY", "revision": 1, "title": "AI for Physics updated"},
+        )
+        assert second.stage_id == first.stage_id
+        with app.repository.connect() as conn:
+            count = conn.execute(
+                "SELECT COUNT(*) FROM admin_staged_items WHERE campaign_id=? AND work_id=?",
+                ("campaign:retry", "W-RETRY"),
+            ).fetchone()[0]
+        assert count == 1
+    finally:
+        app.close()
+
+
 def test_admin_extract_preflights_provider_before_creating_job(tmp_path: Path, monkeypatch) -> None:
     app = AdminWorkspace.open(working_directory=tmp_path / "admin")
     try:
```

**File**: `Principia-v1.4.1/core/tests/test_v14_literature_search_acquisition.py` (modified, +16/-0)
```diff
@@ -53,6 +53,22 @@ def test_goal_rerank_suppresses_generic_keyword_false_friends() -> None:
     assert ranked[0]["relevance_score"] > ranked[1]["relevance_score"]
 
 
+def test_ai_for_physics_rerank_requires_both_domain_anchors() -> None:
+    ranked = rank_literature_for_goal(
+        "AI for Physics",
+        [
+            {"work_id": "work:policy", "rank": 1, "retrieval_rank": 1,
+             "title": "Artificial intelligence policy for higher education",
+             "abstract": "A governance survey of classroom adoption."},
+            {"work_id": "work:physics", "rank": 8, "retrieval_rank": 8,
+             "title": "Physics-informed neural networks for turbulent flow",
+             "abstract": "Deep learning enforces conservation constraints in fluid simulations."},
+        ],
+    )
+    assert ranked[0]["work_id"] == "work:physics"
+    assert [item["work_id"] for item in ranked] == ["work:physics"]
+
+
 def test_semantic_retrieval_order_is_not_overridden_by_exact_title_stuffing() -> None:
     ranked = rank_literature_for_goal(
         "how does multi-agent systems improve autonomous scientific discovery",
```

**File**: `Principia-v1.4.1/core/tests/test_v14_scientific_quality_v2.py` (modified, +57/-0)
```diff
@@ -129,6 +129,63 @@ def test_cross_study_claim_requires_two_independent_works() -> None:
     assert QualityReason.UNSUPPORTED_GENERALIZATION in reasons
 
 
+def test_ai_for_physics_goal_accepts_physics_informed_neural_evidence() -> None:
+    quotation = (
+        "Physics-informed neural networks reduced conservation error in fluid "
+        "simulations under the tested boundary conditions."
+    )
+    atom = _atom(work_id="work:ai-physics", claim=quotation, quotation=quotation)
+    argument = _argument(
+        atom, canonical_claim=quotation,
+        subject_system="fluid simulations using physics-informed neural networks",
+        driver_or_intervention="physics-informed neural constraints",
+        outcome="conservation error", direction_or_qualifier="reduced",
+        conditions=["the tested boundary conditions"],
+        boundary=["fluid simulations represented in the evaluation"],
+        testability="Compare conservation error with and without neural constraints.",
+    )
+    reasons = ScientificQualityGate().validate_argument(
+        argument, atoms=[atom], independent_work_ids={"work:ai-physics"},
+        goal="AI for Physics",
+    )
+    assert QualityReason.OFF_GOAL not in reasons
+
+
+def test_ai_for_physics_goal_rejects_unrelated_ai_policy_claim() -> None:
+    quotation = "Artificial intelligence tutoring increased course completion rates."
+    atom = _atom(work_id="work:education", claim=quotation, quotation=quotation)
+    argument = _argument(
+        atom, canonical_claim=quotation,
+        subject_system="artificial intelligence tutoring in online courses",
+        driver_or_intervention="automated tutoring", outcome="course completion rates",
+        direction_or_qualifier="increased", conditions=["online courses"],
+        boundary=["the evaluated education program"],
+        testability="Compare completion rates with and without automated tutoring.",
+    )
+    reasons = ScientificQualityGate().validate_argument(
+        argument, atoms=[atom], independent_work_ids={"work:education"},
+        goal="AI for Physics",
+    )
+    assert QualityReason.OFF_GOAL in reasons
+
+
+def test_single_term_goal_never_requires_two_distinct_overlaps() -> None:
+    quotation = "Turbulence increased mixing under the measured flow conditions."
+    atom = _atom(work_id="work:turbulence", claim=quotation, quotation=quotation)
+    argument = _argument(
+        atom, canonical_claim=quotation, subject_system="turbulence in channel flow",
+        driver_or_intervention="turbulence", outcome="mixing",
+        direction_or_qualifier="increased",
+        conditions=["the measured flow conditions"],
+        boundary=["the evaluated channel geometry"],
+        testability="Measure mixing across controlled turbulence intensities.",
+    )
+    reasons = ScientificQualityGate().validate_argument(
+        argument, atoms=[atom], independent_work_ids={"work:turbulence"}, goal="turbulence",
+    )
+    assert QualityReason.OFF_GOAL not in reasons
+
+
 def test_atom_anchor_must_be_exact_and_source_key_known() -> None:
     atom = _atom(
         work_id="work:one",
```

---

### Incident Patch 7: `798d2619` (2026-08-13)
**Commit Message**: Fix reviewed Global Cloud workflow paths

Use the Principia-v1.4.1/core monorepo path for dependency installation and canonical cloud validation.

**File**: `.github/workflows/global-cloud-reviewed-pr.yml` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ jobs:
         with:
           python-version: "3.12"
           cache: pip
-      - run: python -m pip install -e .
-      - run: python scripts/validate_global_cloud.py global-cloud
+      - run: python -m pip install -e Principia-v1.4.1/core
+      - run: python Principia-v1.4.1/core/scripts/validate_global_cloud.py global-cloud
       - name: Reject forbidden files and secrets
         run: |
           test -z "$(find global-cloud -type f -size +50M -print -quit)"
```

---

### Incident Patch 8: `f38d73bd` (2026-08-12)
**Commit Message**: Fix v1.4 documentation links

**File**: `Principia-v1.4/core/README.md` (modified, +25/-25)
```diff
@@ -6,17 +6,17 @@
 <p align="center">
   <a href="https://pypi.org/project/principia-ai/"><img alt="PyPI" src="https://img.shields.io/pypi/v/principia-ai?style=flat-square&amp;logo=pypi&amp;logoColor=white&amp;label=PyPI"></a>
   <a href="https://pypi.org/project/principia-ai/"><img alt="Python versions" src="https://img.shields.io/pypi/pyversions/principia-ai?style=flat-square&amp;logo=python&amp;logoColor=white"></a>
-  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/CHANGELOG.md"><img alt="Release v1.4.0" src="https://img.shields.io/badge/release-v1.4.0-111827?style=flat-square"></a>
-  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0F766E?style=flat-square"></a>
+  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/CHANGELOG.md"><img alt="Release v1.4.0" src="https://img.shields.io/badge/release-v1.4.0-111827?style=flat-square"></a>
+  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-0F766E?style=flat-square"></a>
   <a href="https://icml.cc/virtual/2026/poster/61557"><img alt="ICML 2026" src="https://img.shields.io/badge/ICML-2026-7C3AED?style=flat-square"></a>
 </p>
 
 <p align="center">
   <a href="https://github.com/pzqpzq/Principia">GitHub</a> ·
   <a href="https://pypi.org/project/principia-ai/">PyPI</a> ·
-  <a href="https://github.com/pzqpzq/Principia/tree/main/Principia-v1.3/docs">Documentation</a> ·
-  <a href="https://github.com/pzqpzq/Principia/tree/main/Principia-v1.3/examples">Examples</a> ·
-  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/RELEASE_QA.md">Release QA</a>
+  <a href="https://github.com/pzqpzq/Principia/tree/main/Principia-v1.4/core/docs">Documentation</a> ·
+  <a href="https://github.com/pzqpzq/Principia/tree/main/Principia-v1.4/core/examples">Examples</a> ·
+  <a href="https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/RELEASE_QA.md">Release QA</a>
 </p>
 
 > **Ideas from principles. Validated by evidence.**
@@ -255,7 +255,7 @@ Private documents are **supplemental**: they never silently replace the requeste
 
 Sending private text to a remote model requires explicit `allow_remote_private_content=True`. The provider receives document content and portable identifiers, not local absolute paths.
 
-See [Private corpus ingestion](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/docs/local-corpus.md) for parser limits, chunking, diagnostics, deduplication, custom parser registration, and cache cleanup.
+See [Private corpus ingestion](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/docs/local-corpus.md) for parser limits, chunking, diagnostics, deduplication, custom parser registration, and cache cleanup.
 
 ---
 
@@ -416,16 +416,16 @@ showcase manifests:
 <!-- PRINCIPIA_SHOWCASE_TABLE_START -->
 | Task | Online | Local | Features | Evidence | Mode | Validation |
 | --- | --- | --- | --- | --- | --- | --- |
-| [Communication-efficient LLM multi-agent reasoning](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/examples/test1/tutorial.ipynb) | 50 | 5 | 55 | 15 | scidialect-evo | passed |
-| [Uncertainty-aware sparse-view dynamic 3D reconstruction](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/examples/test2/tutorial.ipynb) | 50 | 5 | 55 | 15 | scidialect-evo | passed |
-| [Broadband squeezed-state axion sensing](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/examples/test3/tutorial.ipynb) | 50 | 5 | 55 | 15 | scidialect-evo | passed |
+| [Communication-efficient LLM multi-agent reasoning](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/examples/test1/tutorial.ipynb) | 50 | 5 | 55 | 15 | scidialect-evo | passed |
+| [Uncertainty-aware sparse-view dynamic 3D reconstruction](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/examples/test2/tutorial.ipynb) | 50 | 5 | 55 | 15 | scidialect-evo | passed |
+| [Broadband squeezed-state axion sensing](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.4/core/examples/test3/tutorial.ipynb) | 50 | 5 | 55 | 15 | scidialect-evo | passed |
 <!-- PRINCIPIA_SHOWCASE_TABLE_END -->
 
 | Research task | Generated Idea Card | Review |
 | --- | --- | --- |
-| Communication-efficient LLM multi-agent reasoning | **Entropy-Constrained Discrete Codebook with Counterfactual Decoding and Diversity-Aware Calibration** | [Notebook](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/examples/test1/tutorial.ipynb) · [Showcase](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/examples/test1/showcase.md) |
-| Uncertainty-aware sparse-view dynamic 3D reconstruction | **AnchorSplat-Dynamic: Sparse Anchor-Based Uncertainty for Uncalibrated Motion** | [Notebook](https://github.com/pzqpzq/Principia/blob/main/Principia-v1.3/examples/test2/tutorial.ipynb) · 
```

---

### Incident Patch 9: `13c1f0b4` (2026-07-20)
**Commit Message**: Merge pull request #11 from pzqpzq/fix/math-validation-repair

Harden math validation and repair across the generation pipeline

**File**: `Principia-v1.3/src/principia/ideas.py` (modified, +30/-8)
```diff
@@ -21,9 +21,11 @@
 from .math import (
     MathValidationError,
     generated_math_issues,
+    math_repair_guidance,
     normalize_latex_formula,
     normalize_latex_symbol,
     normalize_math_text,
+    omit_invalid_math_strings,
     tokenize_math_spans,
 )
 from .models import (
@@ -72,12 +74,13 @@
 
 METHODOLOGICAL_SCHEMA_CONTRACT = (
     'methodological_details must use exactly this nested shape: {"summary":"...",'
-    '"symbols":[{"symbol":"...","definition":"..."}],'
+    '"symbols":[{"symbol":"$...$","definition":"..."}],'
     '"equations":[{"name":"...","latex":"$$...$$","explanation":"..."}],'
     '"workflow":[{"step":"short semantic label","detail":"..."}],'
     '"reliability_checks":[{"check":"short semantic label","detail":"..."}]}. '
     "symbols and equations may be empty only when the evidence does not support a grounded "
-    "formalization; workflow and reliability_checks must remain structured objects. "
+    "formalization; every symbol must be one canonical inline $...$ span, every equation latex value "
+    "must be one canonical display $$...$$ span, and workflow and reliability_checks must remain structured objects. "
 )
 GOAL_COVERAGE_CONTRACT = (
     "Address every explicit requirement, boundary condition, preservation clause, risk, and "
@@ -86,6 +89,10 @@
     "interpretability, noise, safety, and false-positive controls in the mechanism or validation "
     "protocol whenever the goal calls for them. "
 )
+MATH_GENERATION_CONTRACT = (
+    "Use equations only when source-grounded; never use programming conditionals inside LaTeX, "
+    "and express conditional formulas with a cases environment. "
+)
 
 
 class IdeaService:
@@ -297,7 +304,8 @@ def compare(
                             'Return {"rows":[{"work_id":"...","title":"...",'
                             '"mechanistic_similarity":"...","essential_difference":"...",'
                             '"potential_advantage":"...","potential_weakness":"..."}]}.\n'
-                            "Each row must name concrete mechanisms from both sides. Do not use boilerplate.\n\n"
+                            "Each row must name concrete mechanisms from both sides. Do not use boilerplate. "
+                            f"{MATH_GENERATION_CONTRACT}\n\n"
                             f"Generated idea content: {json.dumps(idea_content_projection(idea), ensure_ascii=False)}\n"
                             f"{untrusted_data_block('prior_idea_records', candidates)}"
                         ),
@@ -310,6 +318,10 @@ def compare(
                 rows = canonicalize_explicit_math(list(payload.get("rows") or []))
                 comparison_issues = generated_math_issues(rows, path="comparison.rows")
                 if comparison_issues:
+                    repair_rows = omit_invalid_math_strings(rows, path="comparison.rows")
+                    repair_guidance = math_repair_guidance(
+                        comparison_issues, context="prose"
+                    )
                     repair_payload = call_with_progress(
                         run,
                         stage="llm_comparison_repair",
@@ -323,9 +335,10 @@ def compare(
                                 'Return {"rows":[...]} with the same comparison claims and row identities. '
                                 "Repair every listed mathematical-format issue. Use canonical $...$ or $$...$$ LaTeX, "
                                 "brace every subscript and superscript, and never introduce a coefficient, power, "
-                                "threshold, denominator, or scientific claim.\n\n"
+                                "threshold, denominator, or scientific claim. "
+                                f"{repair_guidance}\n\n"
                                 f"Issues: {json.dumps(comparison_issues, ensure_ascii=False)}\n\n"
-                                f"Rows: {json.dumps(rows, ensure_ascii=False)}\n\n"
+                                f"Rows: {json.dumps(repair_rows, ensure_ascii=False)}\n\n"
                                 f"Generated idea content: {json.dumps(idea_content_projection(idea), ensure_ascii=False)}\n"
                                 f"{untrusted_data_block('prior_idea_records', candidates)}"
                             ),
@@ -398,6 +411,7 @@ def _idea_prompt(self, packet: EvidencePacket, mode: str) -> str:
             f"{METHODOLOGICAL_SCHEMA_CONTRACT}"
             "Use empty symbol/equation lists when the selected discipline does not support a grounded formalization; never add generic equations. "
             "When equations are supported, include name, latex, and explanation and wrap formulas in $...$ or $$...$$. "
+            f"{MATH_GENERATION_CONTRACT}"
             "Workflow step labels must be short semantic labels without numbering; do not write labels like 'Step 2' or details prefixed by '2.'. "
             "Treat baselines as comparators, controls, standard methods, or reference theories as appropriate to the disci
```

**File**: `Principia-v1.3/src/principia/math.py` (modified, +90/-0)
```diff
@@ -334,6 +334,96 @@ def generated_math_issues(value: Any, *, path: str = "value") -> list[str]:
     return list(dict.fromkeys(issues))
 
 
+def omit_invalid_math_strings(value: Any, *, path: str = "value") -> Any:
+    """Remove invalid generated strings from an LLM repair draft.
+
+    The surrounding record structure and valid fields are preserved so a
+    repair model can reconstruct only the rejected value without copying it.
+    """
+
+    if isinstance(value, str):
+        return None if generated_math_issues(value, path=path) else value
+    if isinstance(value, list):
+        return [
+            omit_invalid_math_strings(item, path=f"{path}[{index}]")
+            for index, item in enumerate(value)
+        ]
+    if isinstance(value, dict):
+        return {
+            key: omit_invalid_math_strings(item, path=f"{path}.{key}")
+            for key, item in value.items()
+        }
+    if isinstance(value, tuple):
+        return tuple(
+            omit_invalid_math_strings(item, path=f"{path}[{index}]")
+            for index, item in enumerate(value)
+        )
+    return value
+
+
+def math_repair_guidance(issues: list[str], *, context: str = "prose") -> str:
+    """Return concise, issue-specific instructions for one strict repair call."""
+
+    issue_text = " ".join(str(issue) for issue in issues).casefold()
+    math_issue = any(
+        marker in issue_text
+        for marker in (
+            "mathematical",
+            "latex",
+            "dollar delimiter",
+            "subscript",
+            "superscript",
+            "programming conditionals",
+            "mathematical equality",
+            "integral(",
+        )
+    )
+    if not math_issue:
+        return ""
+
+    guidance = ["Mathematical validation failed; repair only the listed fields."]
+    if "mathematical unicode" in issue_text:
+        guidance.append(
+            "Never copy Unicode mathematical symbols, operators, superscripts, or subscripts; "
+            "rewrite U+03C3 as `sigma`, U+2264 as `less than or equal to`, and superscript two as `squared`."
+        )
+    if "programming conditionals" in issue_text:
+        guidance.append(
+            "Never use `if`, `elif`, `else`, or ternary syntax in an equation; use a source-grounded "
+            r"LaTeX cases form such as $$f(x)=\begin{cases}1,&x>0\\0,&\text{otherwise}\end{cases}$$."
+        )
+        if context == "idea":
+            guidance.append(
+                "If the evidence does not support the exact formula, return the complete Idea Card with "
+                "methodological_details.equations set to an empty list."
+            )
+    if "mathematical equality" in issue_text:
+        guidance.append("Use `=` for mathematical equality, never `==`.")
+    if "integral(" in issue_text:
+        guidance.append(r"Use a canonical `\int` expression, never programming-style `integral(...)`.")
+    if "repeated subscript or superscript" in issue_text:
+        guidance.append(
+            "Use exactly one braced subscript and one braced superscript per base symbol, or paraphrase the claim."
+        )
+    if any(
+        marker in issue_text
+        for marker in (
+            "delimiter",
+            "backslash",
+            "control character",
+            "malformed latex",
+            "unsafe characters",
+            "latex parser",
+        )
+    ):
+        guidance.append(
+            "Use only balanced $...$ or $$...$$ spans with correctly JSON-escaped LaTeX backslashes; "
+            "otherwise paraphrase in plain language."
+        )
+    guidance.append("Before returning JSON, verify that none of the listed mathematical defects remains.")
+    return " ".join(guidance)
+
+
 def _normalize_body(value: str) -> str:
     body = str(value or "").strip()
     if not body:
```

**File**: `Principia-v1.3/src/principia/research.py` (modified, +13/-42)
```diff
@@ -23,7 +23,7 @@
 from .ids import normalize_key, readable_id, short_hash
 from .llm import UNTRUSTED_DATA_POLICY, LLMClient, untrusted_data_block
 from .local_sources import LocalCorpusIngestor, chunk_local_text
-from .math import generated_math_issues, math_issues
+from .math import generated_math_issues, math_repair_guidance, omit_invalid_math_strings
 from .models import (
     CancelToken,
     ExtractedFeatures,
@@ -953,23 +953,20 @@ def call() -> dict[str, Any]:
         issues = extraction_payload_issues(payload, work, authoritative_text)
         warnings = [warning for item in chunks for warning in item.extraction_warnings]
         if issues:
-            has_math_issue = any("Mathematical" in issue or "LaTeX" in issue for issue in issues)
-            math_repair_instruction = (
-                " Mathematical validation failed. Re-express every affected claim as grounded plain "
-                "language with no formula delimiters or backslash commands; do not reproduce the "
-                "malformed expression."
-                if has_math_issue
-                else ""
+            math_repair_instruction = math_repair_guidance(issues, context="prose")
+            repair_payload = (
+                omit_invalid_math_strings(payload, path="extraction")
+                if math_repair_instruction
+                else payload
             )
-            repair_payload = _omit_invalid_math_strings(payload) if has_math_issue else payload
             repair_user = (
                 f"{EXTRACTION_SCHEMA_PROMPT}\n\n"
                 f"Validation issues: {json.dumps(issues, ensure_ascii=False)}\n\n"
                 f"Original consolidation: {json.dumps(repair_payload, ensure_ascii=False)}\n\n"
                 "Repair every listed issue using only those feature bundles. If ideas, principles, "
                 "or takeaways is reported missing, return at least one concise, grounded record for "
                 "that category. Return one strict JSON object."
-                + math_repair_instruction
+                + (" " + math_repair_instruction if math_repair_instruction else "")
                 + "\n\n"
                 + untrusted_data_block("local_chunk_feature_bundles", chunk_payloads)
             )
@@ -1084,22 +1081,19 @@ def call() -> dict[str, Any]:
                 "valid dollar-delimited LaTeX with correctly JSON-escaped backslashes and no control "
                 "characters."
             )
-            has_math_issue = any("Mathematical" in issue or "LaTeX" in issue for issue in issues)
-            math_repair_instruction = (
-                " Mathematical validation failed. Re-express every affected claim as grounded plain "
-                "language with no formula delimiters or backslash commands; do not reproduce the "
-                "malformed expression."
-                if has_math_issue
-                else ""
+            math_repair_instruction = math_repair_guidance(issues, context="prose")
+            repair_payload = (
+                omit_invalid_math_strings(payload, path="extraction")
+                if math_repair_instruction
+                else payload
             )
-            repair_payload = _omit_invalid_math_strings(payload) if has_math_issue else payload
             repair_user = (
                 f"{EXTRACTION_SCHEMA_PROMPT}\n\n"
                 f"Validation issues: {json.dumps(issues, ensure_ascii=False)}\n\n"
                 f"Original extraction: {json.dumps(repair_payload, ensure_ascii=False)}\n\n"
                 f"Work: {json.dumps(_prompt_work_metadata(work), ensure_ascii=False)}\n\n"
                 "Repair every listed issue using only the delimited source evidence."
-                + math_repair_instruction
+                + (" " + math_repair_instruction if math_repair_instruction else "")
                 + "\n\n"
                 + untrusted_data_block("source_evidence", {"text": evidence_text})
             )
@@ -1993,29 +1987,6 @@ def extraction_payload_issues(
     return issues
 
 
-def _omit_invalid_math_strings(value: Any, *, path: str = "extraction") -> Any:
-    """Omit malformed strings from repair input without synthesizing output.
-
-    The authoritative source remains available to the LLM, which must
-    reconstruct each omitted field. In particular, this prevents JSON control
-    escapes such as ``\\f`` from being copied into the repaired response.
-    """
-
-    if isinstance(value, str):
-        return None if math_issues(value, path=path) else value
-    if isinstance(value, list):
-        return [
-            _omit_invalid_math_strings(item, path=f"{path}[{index}]")
-            for index, item in enumerate(value)
-        ]
-    if isinstance(value, dict):
-        return {
-            key: _omit_invalid_math_strings(item, path=f"{path}.{key}")
-            for key, item in value.items()
-        }
-    return value
-
-
 _GROUNDING_STOPWORDS = SEARCH_STOPWORDS | {
     "analysis",
  
```

**File**: `Principia-v1.3/tests/test_integrity_v133.py` (modified, +114/-1)
```diff
@@ -15,9 +15,11 @@
 from principia.llm import UNTRUSTED_DATA_POLICY, LLMClient, LLMConfig, untrusted_data_block
 from principia.math import (
     MathValidationError,
+    math_repair_guidance,
     normalize_latex_formula,
     normalize_latex_symbol,
     normalize_math_text,
+    omit_invalid_math_strings,
     tokenize_math_spans,
 )
 from principia.models import EvidencePacket, Idea, IdeaComparison, WorkFeatures
@@ -280,7 +282,7 @@ def test_live_methodology_contract_rejects_unstructured_nested_rows() -> None:
 def test_candidate_prompt_preserves_full_goal_constraints_and_nested_schema() -> None:
     prompt = candidate_generation_prompt(mixed_evidence_packet())
 
-    assert '"symbols":[{"symbol":"...","definition":"..."}]' in prompt
+    assert '"symbols":[{"symbol":"$...$","definition":"..."}]' in prompt
     assert '"workflow":[{"step":"short semantic label","detail":"..."}]' in prompt
     assert "Do not discard a goal constraint during candidate selection" in prompt
     assert "false-positive controls" in prompt
@@ -456,6 +458,44 @@ def chat_json(self, system: str, user: str, **kwargs):
     assert len(comparison_llm.prompts) == 1
 
 
+def test_live_comparison_repair_uses_sanitized_unicode_fields(tmp_path: Path) -> None:
+    invalid_row = {
+        "work_id": "LOCAL1",
+        "title": "Compact interpretable protocol",
+        "mechanistic_similarity": "Both methods monitor semantic recovery during compact communication tasks.",
+        "essential_difference": "The proposal explicitly controls noise σ during protocol learning.",
+        "potential_advantage": "The added control exposes a measurable robustness target during evaluation.",
+        "potential_weakness": "The control may reduce communication capacity on difficult coordination tasks.",
+    }
+    repaired_row = {
+        **invalid_row,
+        "essential_difference": "The proposal explicitly controls the noise scale during protocol learning.",
+    }
+
+    class UnicodeRepairComparisonLLM(ComparisonLLM):
+        def chat_json(self, system: str, user: str, **kwargs):
+            self.prompts.append((system, user))
+            return {"rows": [repaired_row if system.startswith("Repair comparison rows") else invalid_row]}
+
+    idea = Idea(
+        id="I-COMPARE-MATH",
+        title="Interpretable compact protocol",
+        thesis="Control compact communication with semantic recovery.",
+        mode="standard",
+    )
+    llm = UnicodeRepairComparisonLLM()
+
+    comparison = IdeaService(WorkspaceStorage(tmp_path), llm).compare(
+        idea, evidence_packet().features, model="custom:integrity"
+    )
+
+    assert len(llm.prompts) == 2
+    repair_prompt = llm.prompts[1][1]
+    assert "rewrite U+03C3 as `sigma`" in repair_prompt
+    assert '"essential_difference": null' in repair_prompt
+    assert comparison.rows[0]["essential_difference"] == repaired_row["essential_difference"]
+
+
 def test_live_generation_repairs_contamination_without_rewriting_legitimate_dialect(
     tmp_path: Path,
 ) -> None:
@@ -476,6 +516,56 @@ def test_live_generation_repairs_contamination_without_rewriting_legitimate_dial
     assert UNTRUSTED_DATA_POLICY in llm.prompts[0][1]
 
 
+def test_live_generation_repairs_programming_conditional_as_latex_cases(
+    tmp_path: Path,
+) -> None:
+    draft = valid_payload()
+    draft["methodological_details"]["equations"][0]["latex"] = (
+        "$$f(x) = 1 if x > 0 else 0$$"
+    )
+    repaired = valid_payload()
+    repaired["methodological_details"]["equations"][0]["latex"] = (
+        r"$$f(x)=\begin{cases}1,&x>0\\0,&\text{otherwise}\end{cases}$$"
+    )
+    llm = CitationMixLLM(draft, repair=repaired)
+    storage = WorkspaceStorage(tmp_path)
+
+    idea = IdeaService(storage, llm).generate(
+        evidence_packet(), mode="standard", model="custom:citation-mix"
+    )
+
+    assert len(llm.prompts) == 2
+    repair_prompt = llm.prompts[1][1]
+    assert "Never use `if`, `elif`, `else`" in repair_prompt
+    assert r"\begin{cases}" in repair_prompt
+    assert '"symbol":"$...$"' in repair_prompt
+    assert "Preserve empty symbol or equation lists" in repair_prompt
+    assert '"latex": null' in repair_prompt
+    assert idea.methodological_details["equations"][0]["latex"] == (
+        r"$$f(x)=\begin{cases}1,&x>0\\0,&\text{otherwise}\end{cases}$$"
+    )
+    assert storage.counts()["ideas"] == 1
+
+
+def test_live_generation_does_not_restore_omitted_invalid_equation(
+    tmp_path: Path,
+) -> None:
+    draft = valid_payload()
+    draft["methodological_details"]["equations"][0]["latex"] = (
+        "$$f(x) = 1 if x > 0 else 0$$"
+    )
+    llm = CitationMixLLM(draft, repair={})
+    storage = WorkspaceStorage(tmp_path)
+
+    with pytest.raises(RuntimeError, match="failed validation after one evidence-grounded repair"):
+        IdeaService(storage, llm).generate(
+            evidence_packet(), mode="standard", model="custom:citation-mix"
+        )
+
+    assert '"latex": null
```

**File**: `Principia-v1.3/tests/test_research_v133.py` (modified, +40/-0)
```diff
@@ -205,6 +205,46 @@ def test_live_extraction_rejects_persistent_unsafe_math_without_persistence(
     assert workspace.counts()["extractions"] == 0
 
 
+def test_live_extraction_repairs_bare_mathematical_unicode(
+    tmp_path: Path, monkeypatch: Any
+) -> None:
+    invalid = valid_payload()
+    invalid["principles"][0]["evidence"] = "Noise scale σ controls calibration stability."
+    repaired = valid_payload()
+    repaired["principles"][0]["evidence"] = (
+        "Noise scale controls calibration stability."
+    )
+    llm = ExtractionLLM([invalid, repaired])
+    workspace = pc.Workspace(tmp_path, llm=llm)
+    work = pc.WorkItem(id="UNICODE-MATH", title="Calibrated resonator noise scale")
+    evidence = (
+        "A superconducting resonator scan uses squeezed readout and calibrated noise. "
+        "Calibrate without signal leakage and track resonator drift during acquisition. "
+        "The resonator noise scale controls calibration stability. "
+    ) * 10
+    monkeypatch.setattr(
+        research_module,
+        "fetch_source_content",
+        lambda *args, **kwargs: SourceContent(text=evidence, content_type="pdf_text"),
+    )
+
+    extracted = workspace.research.extract(
+        [work], model="custom:cross-domain-extractor"
+    )
+
+    assert llm.calls == 2
+    repair_prompt = llm.prompts[1][1]
+    assert "Mathematical validation failed" in repair_prompt
+    repair_context = repair_prompt.split("<BEGIN_UNTRUSTED_SOURCE_EVIDENCE>", 1)[0]
+    assert '"evidence": null' in repair_context
+    assert "σ" not in repair_context
+    assert "Never copy Unicode mathematical symbols" in repair_context
+    assert "rewrite U+03C3 as `sigma`" in repair_context
+    assert extracted.items[0].principles[0]["evidence"] == (
+        "Noise scale controls calibration stability."
+    )
+
+
 def test_extraction_allows_genuinely_empty_individual_category(
     tmp_path: Path, monkeypatch: Any
 ) -> None:
```

---

### Incident Patch 10: `70ac53ed` (2026-07-20)
**Commit Message**: fix: unify math repair across generation pipeline

**File**: `Principia-v1.3/src/principia/ideas.py` (modified, +30/-8)
```diff
@@ -21,9 +21,11 @@
 from .math import (
     MathValidationError,
     generated_math_issues,
+    math_repair_guidance,
     normalize_latex_formula,
     normalize_latex_symbol,
     normalize_math_text,
+    omit_invalid_math_strings,
     tokenize_math_spans,
 )
 from .models import (
@@ -72,12 +74,13 @@
 
 METHODOLOGICAL_SCHEMA_CONTRACT = (
     'methodological_details must use exactly this nested shape: {"summary":"...",'
-    '"symbols":[{"symbol":"...","definition":"..."}],'
+    '"symbols":[{"symbol":"$...$","definition":"..."}],'
     '"equations":[{"name":"...","latex":"$$...$$","explanation":"..."}],'
     '"workflow":[{"step":"short semantic label","detail":"..."}],'
     '"reliability_checks":[{"check":"short semantic label","detail":"..."}]}. '
     "symbols and equations may be empty only when the evidence does not support a grounded "
-    "formalization; workflow and reliability_checks must remain structured objects. "
+    "formalization; every symbol must be one canonical inline $...$ span, every equation latex value "
+    "must be one canonical display $$...$$ span, and workflow and reliability_checks must remain structured objects. "
 )
 GOAL_COVERAGE_CONTRACT = (
     "Address every explicit requirement, boundary condition, preservation clause, risk, and "
@@ -86,6 +89,10 @@
     "interpretability, noise, safety, and false-positive controls in the mechanism or validation "
     "protocol whenever the goal calls for them. "
 )
+MATH_GENERATION_CONTRACT = (
+    "Use equations only when source-grounded; never use programming conditionals inside LaTeX, "
+    "and express conditional formulas with a cases environment. "
+)
 
 
 class IdeaService:
@@ -297,7 +304,8 @@ def compare(
                             'Return {"rows":[{"work_id":"...","title":"...",'
                             '"mechanistic_similarity":"...","essential_difference":"...",'
                             '"potential_advantage":"...","potential_weakness":"..."}]}.\n'
-                            "Each row must name concrete mechanisms from both sides. Do not use boilerplate.\n\n"
+                            "Each row must name concrete mechanisms from both sides. Do not use boilerplate. "
+                            f"{MATH_GENERATION_CONTRACT}\n\n"
                             f"Generated idea content: {json.dumps(idea_content_projection(idea), ensure_ascii=False)}\n"
                             f"{untrusted_data_block('prior_idea_records', candidates)}"
                         ),
@@ -310,6 +318,10 @@ def compare(
                 rows = canonicalize_explicit_math(list(payload.get("rows") or []))
                 comparison_issues = generated_math_issues(rows, path="comparison.rows")
                 if comparison_issues:
+                    repair_rows = omit_invalid_math_strings(rows, path="comparison.rows")
+                    repair_guidance = math_repair_guidance(
+                        comparison_issues, context="prose"
+                    )
                     repair_payload = call_with_progress(
                         run,
                         stage="llm_comparison_repair",
@@ -323,9 +335,10 @@ def compare(
                                 'Return {"rows":[...]} with the same comparison claims and row identities. '
                                 "Repair every listed mathematical-format issue. Use canonical $...$ or $$...$$ LaTeX, "
                                 "brace every subscript and superscript, and never introduce a coefficient, power, "
-                                "threshold, denominator, or scientific claim.\n\n"
+                                "threshold, denominator, or scientific claim. "
+                                f"{repair_guidance}\n\n"
                                 f"Issues: {json.dumps(comparison_issues, ensure_ascii=False)}\n\n"
-                                f"Rows: {json.dumps(rows, ensure_ascii=False)}\n\n"
+                                f"Rows: {json.dumps(repair_rows, ensure_ascii=False)}\n\n"
                                 f"Generated idea content: {json.dumps(idea_content_projection(idea), ensure_ascii=False)}\n"
                                 f"{untrusted_data_block('prior_idea_records', candidates)}"
                             ),
@@ -398,6 +411,7 @@ def _idea_prompt(self, packet: EvidencePacket, mode: str) -> str:
             f"{METHODOLOGICAL_SCHEMA_CONTRACT}"
             "Use empty symbol/equation lists when the selected discipline does not support a grounded formalization; never add generic equations. "
             "When equations are supported, include name, latex, and explanation and wrap formulas in $...$ or $$...$$. "
+            f"{MATH_GENERATION_CONTRACT}"
             "Workflow step labels must be short semantic labels without numbering; do not write labels like 'Step 2' or details prefixed by '2.'. "
             "Treat baselines as comparators, controls, standard methods, or reference theories as appropriate to the disci
```

**File**: `Principia-v1.3/src/principia/math.py` (modified, +90/-0)
```diff
@@ -334,6 +334,96 @@ def generated_math_issues(value: Any, *, path: str = "value") -> list[str]:
     return list(dict.fromkeys(issues))
 
 
+def omit_invalid_math_strings(value: Any, *, path: str = "value") -> Any:
+    """Remove invalid generated strings from an LLM repair draft.
+
+    The surrounding record structure and valid fields are preserved so a
+    repair model can reconstruct only the rejected value without copying it.
+    """
+
+    if isinstance(value, str):
+        return None if generated_math_issues(value, path=path) else value
+    if isinstance(value, list):
+        return [
+            omit_invalid_math_strings(item, path=f"{path}[{index}]")
+            for index, item in enumerate(value)
+        ]
+    if isinstance(value, dict):
+        return {
+            key: omit_invalid_math_strings(item, path=f"{path}.{key}")
+            for key, item in value.items()
+        }
+    if isinstance(value, tuple):
+        return tuple(
+            omit_invalid_math_strings(item, path=f"{path}[{index}]")
+            for index, item in enumerate(value)
+        )
+    return value
+
+
+def math_repair_guidance(issues: list[str], *, context: str = "prose") -> str:
+    """Return concise, issue-specific instructions for one strict repair call."""
+
+    issue_text = " ".join(str(issue) for issue in issues).casefold()
+    math_issue = any(
+        marker in issue_text
+        for marker in (
+            "mathematical",
+            "latex",
+            "dollar delimiter",
+            "subscript",
+            "superscript",
+            "programming conditionals",
+            "mathematical equality",
+            "integral(",
+        )
+    )
+    if not math_issue:
+        return ""
+
+    guidance = ["Mathematical validation failed; repair only the listed fields."]
+    if "mathematical unicode" in issue_text:
+        guidance.append(
+            "Never copy Unicode mathematical symbols, operators, superscripts, or subscripts; "
+            "rewrite U+03C3 as `sigma`, U+2264 as `less than or equal to`, and superscript two as `squared`."
+        )
+    if "programming conditionals" in issue_text:
+        guidance.append(
+            "Never use `if`, `elif`, `else`, or ternary syntax in an equation; use a source-grounded "
+            r"LaTeX cases form such as $$f(x)=\begin{cases}1,&x>0\\0,&\text{otherwise}\end{cases}$$."
+        )
+        if context == "idea":
+            guidance.append(
+                "If the evidence does not support the exact formula, return the complete Idea Card with "
+                "methodological_details.equations set to an empty list."
+            )
+    if "mathematical equality" in issue_text:
+        guidance.append("Use `=` for mathematical equality, never `==`.")
+    if "integral(" in issue_text:
+        guidance.append(r"Use a canonical `\int` expression, never programming-style `integral(...)`.")
+    if "repeated subscript or superscript" in issue_text:
+        guidance.append(
+            "Use exactly one braced subscript and one braced superscript per base symbol, or paraphrase the claim."
+        )
+    if any(
+        marker in issue_text
+        for marker in (
+            "delimiter",
+            "backslash",
+            "control character",
+            "malformed latex",
+            "unsafe characters",
+            "latex parser",
+        )
+    ):
+        guidance.append(
+            "Use only balanced $...$ or $$...$$ spans with correctly JSON-escaped LaTeX backslashes; "
+            "otherwise paraphrase in plain language."
+        )
+    guidance.append("Before returning JSON, verify that none of the listed mathematical defects remains.")
+    return " ".join(guidance)
+
+
 def _normalize_body(value: str) -> str:
     body = str(value or "").strip()
     if not body:
```

**File**: `Principia-v1.3/src/principia/research.py` (modified, +13/-57)
```diff
@@ -23,7 +23,7 @@
 from .ids import normalize_key, readable_id, short_hash
 from .llm import UNTRUSTED_DATA_POLICY, LLMClient, untrusted_data_block
 from .local_sources import LocalCorpusIngestor, chunk_local_text
-from .math import generated_math_issues
+from .math import generated_math_issues, math_repair_guidance, omit_invalid_math_strings
 from .models import (
     CancelToken,
     ExtractedFeatures,
@@ -953,26 +953,20 @@ def call() -> dict[str, Any]:
         issues = extraction_payload_issues(payload, work, authoritative_text)
         warnings = [warning for item in chunks for warning in item.extraction_warnings]
         if issues:
-            has_math_issue = _has_math_validation_issue(issues)
-            math_repair_instruction = (
-                " Mathematical validation failed. Re-express every affected claim as grounded plain "
-                "language with no formula delimiters or backslash commands; do not reproduce the "
-                "malformed expression. Never copy Unicode mathematical symbols, operators, superscripts, "
-                "or subscripts from the source into a repaired field. Example: rewrite U+03C3 as `sigma`, "
-                "U+2264 as `less than or equal to`, and superscript two as `squared`; then verify that no "
-                "mathematical Unicode remains before returning JSON."
-                if has_math_issue
-                else ""
+            math_repair_instruction = math_repair_guidance(issues, context="prose")
+            repair_payload = (
+                omit_invalid_math_strings(payload, path="extraction")
+                if math_repair_instruction
+                else payload
             )
-            repair_payload = _omit_invalid_math_strings(payload) if has_math_issue else payload
             repair_user = (
                 f"{EXTRACTION_SCHEMA_PROMPT}\n\n"
                 f"Validation issues: {json.dumps(issues, ensure_ascii=False)}\n\n"
                 f"Original consolidation: {json.dumps(repair_payload, ensure_ascii=False)}\n\n"
                 "Repair every listed issue using only those feature bundles. If ideas, principles, "
                 "or takeaways is reported missing, return at least one concise, grounded record for "
                 "that category. Return one strict JSON object."
-                + math_repair_instruction
+                + (" " + math_repair_instruction if math_repair_instruction else "")
                 + "\n\n"
                 + untrusted_data_block("local_chunk_feature_bundles", chunk_payloads)
             )
@@ -1087,25 +1081,19 @@ def call() -> dict[str, Any]:
                 "valid dollar-delimited LaTeX with correctly JSON-escaped backslashes and no control "
                 "characters."
             )
-            has_math_issue = _has_math_validation_issue(issues)
-            math_repair_instruction = (
-                " Mathematical validation failed. Re-express every affected claim as grounded plain "
-                "language with no formula delimiters or backslash commands; do not reproduce the "
-                "malformed expression. Never copy Unicode mathematical symbols, operators, superscripts, "
-                "or subscripts from the source into a repaired field. Example: rewrite U+03C3 as `sigma`, "
-                "U+2264 as `less than or equal to`, and superscript two as `squared`; then verify that no "
-                "mathematical Unicode remains before returning JSON."
-                if has_math_issue
-                else ""
+            math_repair_instruction = math_repair_guidance(issues, context="prose")
+            repair_payload = (
+                omit_invalid_math_strings(payload, path="extraction")
+                if math_repair_instruction
+                else payload
             )
-            repair_payload = _omit_invalid_math_strings(payload) if has_math_issue else payload
             repair_user = (
                 f"{EXTRACTION_SCHEMA_PROMPT}\n\n"
                 f"Validation issues: {json.dumps(issues, ensure_ascii=False)}\n\n"
                 f"Original extraction: {json.dumps(repair_payload, ensure_ascii=False)}\n\n"
                 f"Work: {json.dumps(_prompt_work_metadata(work), ensure_ascii=False)}\n\n"
                 "Repair every listed issue using only the delimited source evidence."
-                + math_repair_instruction
+                + (" " + math_repair_instruction if math_repair_instruction else "")
                 + "\n\n"
                 + untrusted_data_block("source_evidence", {"text": evidence_text})
             )
@@ -1999,38 +1987,6 @@ def extraction_payload_issues(
     return issues
 
 
-def _omit_invalid_math_strings(value: Any, *, path: str = "extraction") -> Any:
-    """Omit malformed strings from repair input without synthesizing output.
-
-    The authoritative source remains available to the LLM, which must
-    reconstruct each omitted field. In particular, this prevents JSON control
```

**File**: `Principia-v1.3/tests/test_integrity_v133.py` (modified, +114/-1)
```diff
@@ -15,9 +15,11 @@
 from principia.llm import UNTRUSTED_DATA_POLICY, LLMClient, LLMConfig, untrusted_data_block
 from principia.math import (
     MathValidationError,
+    math_repair_guidance,
     normalize_latex_formula,
     normalize_latex_symbol,
     normalize_math_text,
+    omit_invalid_math_strings,
     tokenize_math_spans,
 )
 from principia.models import EvidencePacket, Idea, IdeaComparison, WorkFeatures
@@ -280,7 +282,7 @@ def test_live_methodology_contract_rejects_unstructured_nested_rows() -> None:
 def test_candidate_prompt_preserves_full_goal_constraints_and_nested_schema() -> None:
     prompt = candidate_generation_prompt(mixed_evidence_packet())
 
-    assert '"symbols":[{"symbol":"...","definition":"..."}]' in prompt
+    assert '"symbols":[{"symbol":"$...$","definition":"..."}]' in prompt
     assert '"workflow":[{"step":"short semantic label","detail":"..."}]' in prompt
     assert "Do not discard a goal constraint during candidate selection" in prompt
     assert "false-positive controls" in prompt
@@ -456,6 +458,44 @@ def chat_json(self, system: str, user: str, **kwargs):
     assert len(comparison_llm.prompts) == 1
 
 
+def test_live_comparison_repair_uses_sanitized_unicode_fields(tmp_path: Path) -> None:
+    invalid_row = {
+        "work_id": "LOCAL1",
+        "title": "Compact interpretable protocol",
+        "mechanistic_similarity": "Both methods monitor semantic recovery during compact communication tasks.",
+        "essential_difference": "The proposal explicitly controls noise σ during protocol learning.",
+        "potential_advantage": "The added control exposes a measurable robustness target during evaluation.",
+        "potential_weakness": "The control may reduce communication capacity on difficult coordination tasks.",
+    }
+    repaired_row = {
+        **invalid_row,
+        "essential_difference": "The proposal explicitly controls the noise scale during protocol learning.",
+    }
+
+    class UnicodeRepairComparisonLLM(ComparisonLLM):
+        def chat_json(self, system: str, user: str, **kwargs):
+            self.prompts.append((system, user))
+            return {"rows": [repaired_row if system.startswith("Repair comparison rows") else invalid_row]}
+
+    idea = Idea(
+        id="I-COMPARE-MATH",
+        title="Interpretable compact protocol",
+        thesis="Control compact communication with semantic recovery.",
+        mode="standard",
+    )
+    llm = UnicodeRepairComparisonLLM()
+
+    comparison = IdeaService(WorkspaceStorage(tmp_path), llm).compare(
+        idea, evidence_packet().features, model="custom:integrity"
+    )
+
+    assert len(llm.prompts) == 2
+    repair_prompt = llm.prompts[1][1]
+    assert "rewrite U+03C3 as `sigma`" in repair_prompt
+    assert '"essential_difference": null' in repair_prompt
+    assert comparison.rows[0]["essential_difference"] == repaired_row["essential_difference"]
+
+
 def test_live_generation_repairs_contamination_without_rewriting_legitimate_dialect(
     tmp_path: Path,
 ) -> None:
@@ -476,6 +516,56 @@ def test_live_generation_repairs_contamination_without_rewriting_legitimate_dial
     assert UNTRUSTED_DATA_POLICY in llm.prompts[0][1]
 
 
+def test_live_generation_repairs_programming_conditional_as_latex_cases(
+    tmp_path: Path,
+) -> None:
+    draft = valid_payload()
+    draft["methodological_details"]["equations"][0]["latex"] = (
+        "$$f(x) = 1 if x > 0 else 0$$"
+    )
+    repaired = valid_payload()
+    repaired["methodological_details"]["equations"][0]["latex"] = (
+        r"$$f(x)=\begin{cases}1,&x>0\\0,&\text{otherwise}\end{cases}$$"
+    )
+    llm = CitationMixLLM(draft, repair=repaired)
+    storage = WorkspaceStorage(tmp_path)
+
+    idea = IdeaService(storage, llm).generate(
+        evidence_packet(), mode="standard", model="custom:citation-mix"
+    )
+
+    assert len(llm.prompts) == 2
+    repair_prompt = llm.prompts[1][1]
+    assert "Never use `if`, `elif`, `else`" in repair_prompt
+    assert r"\begin{cases}" in repair_prompt
+    assert '"symbol":"$...$"' in repair_prompt
+    assert "Preserve empty symbol or equation lists" in repair_prompt
+    assert '"latex": null' in repair_prompt
+    assert idea.methodological_details["equations"][0]["latex"] == (
+        r"$$f(x)=\begin{cases}1,&x>0\\0,&\text{otherwise}\end{cases}$$"
+    )
+    assert storage.counts()["ideas"] == 1
+
+
+def test_live_generation_does_not_restore_omitted_invalid_equation(
+    tmp_path: Path,
+) -> None:
+    draft = valid_payload()
+    draft["methodological_details"]["equations"][0]["latex"] = (
+        "$$f(x) = 1 if x > 0 else 0$$"
+    )
+    llm = CitationMixLLM(draft, repair={})
+    storage = WorkspaceStorage(tmp_path)
+
+    with pytest.raises(RuntimeError, match="failed validation after one evidence-grounded repair"):
+        IdeaService(storage, llm).generate(
+            evidence_packet(), mode="standard", model="custom:citation-mix"
+        )
+
+    assert '"latex": null
```

---

### Incident Patch 11: `c86326f9` (2026-07-20)
**Commit Message**: fix: harden extraction math repair

**File**: `Principia-v1.3/src/principia/research.py` (modified, +21/-6)
```diff
@@ -23,7 +23,7 @@
 from .ids import normalize_key, readable_id, short_hash
 from .llm import UNTRUSTED_DATA_POLICY, LLMClient, untrusted_data_block
 from .local_sources import LocalCorpusIngestor, chunk_local_text
-from .math import generated_math_issues, math_issues
+from .math import generated_math_issues
 from .models import (
     CancelToken,
     ExtractedFeatures,
@@ -953,11 +953,14 @@ def call() -> dict[str, Any]:
         issues = extraction_payload_issues(payload, work, authoritative_text)
         warnings = [warning for item in chunks for warning in item.extraction_warnings]
         if issues:
-            has_math_issue = any("Mathematical" in issue or "LaTeX" in issue for issue in issues)
+            has_math_issue = _has_math_validation_issue(issues)
             math_repair_instruction = (
                 " Mathematical validation failed. Re-express every affected claim as grounded plain "
                 "language with no formula delimiters or backslash commands; do not reproduce the "
-                "malformed expression."
+                "malformed expression. Never copy Unicode mathematical symbols, operators, superscripts, "
+                "or subscripts from the source into a repaired field. Example: rewrite U+03C3 as `sigma`, "
+                "U+2264 as `less than or equal to`, and superscript two as `squared`; then verify that no "
+                "mathematical Unicode remains before returning JSON."
                 if has_math_issue
                 else ""
             )
@@ -1084,11 +1087,14 @@ def call() -> dict[str, Any]:
                 "valid dollar-delimited LaTeX with correctly JSON-escaped backslashes and no control "
                 "characters."
             )
-            has_math_issue = any("Mathematical" in issue or "LaTeX" in issue for issue in issues)
+            has_math_issue = _has_math_validation_issue(issues)
             math_repair_instruction = (
                 " Mathematical validation failed. Re-express every affected claim as grounded plain "
                 "language with no formula delimiters or backslash commands; do not reproduce the "
-                "malformed expression."
+                "malformed expression. Never copy Unicode mathematical symbols, operators, superscripts, "
+                "or subscripts from the source into a repaired field. Example: rewrite U+03C3 as `sigma`, "
+                "U+2264 as `less than or equal to`, and superscript two as `squared`; then verify that no "
+                "mathematical Unicode remains before returning JSON."
                 if has_math_issue
                 else ""
             )
@@ -2002,7 +2008,7 @@ def _omit_invalid_math_strings(value: Any, *, path: str = "extraction") -> Any:
     """
 
     if isinstance(value, str):
-        return None if math_issues(value, path=path) else value
+        return None if generated_math_issues(value, path=path) else value
     if isinstance(value, list):
         return [
             _omit_invalid_math_strings(item, path=f"{path}[{index}]")
@@ -2016,6 +2022,15 @@ def _omit_invalid_math_strings(value: Any, *, path: str = "extraction") -> Any:
     return value
 
 
+def _has_math_validation_issue(issues: list[str]) -> bool:
+    """Recognize every math-validator issue regardless of message casing."""
+
+    return any(
+        "mathematical" in issue.casefold() or "latex" in issue.casefold()
+        for issue in issues
+    )
+
+
 _GROUNDING_STOPWORDS = SEARCH_STOPWORDS | {
     "analysis",
     "approach",
```

**File**: `Principia-v1.3/tests/test_research_v133.py` (modified, +40/-0)
```diff
@@ -205,6 +205,46 @@ def test_live_extraction_rejects_persistent_unsafe_math_without_persistence(
     assert workspace.counts()["extractions"] == 0
 
 
+def test_live_extraction_repairs_bare_mathematical_unicode(
+    tmp_path: Path, monkeypatch: Any
+) -> None:
+    invalid = valid_payload()
+    invalid["principles"][0]["evidence"] = "Noise scale σ controls calibration stability."
+    repaired = valid_payload()
+    repaired["principles"][0]["evidence"] = (
+        "Noise scale controls calibration stability."
+    )
+    llm = ExtractionLLM([invalid, repaired])
+    workspace = pc.Workspace(tmp_path, llm=llm)
+    work = pc.WorkItem(id="UNICODE-MATH", title="Calibrated resonator noise scale")
+    evidence = (
+        "A superconducting resonator scan uses squeezed readout and calibrated noise. "
+        "Calibrate without signal leakage and track resonator drift during acquisition. "
+        "The resonator noise scale controls calibration stability. "
+    ) * 10
+    monkeypatch.setattr(
+        research_module,
+        "fetch_source_content",
+        lambda *args, **kwargs: SourceContent(text=evidence, content_type="pdf_text"),
+    )
+
+    extracted = workspace.research.extract(
+        [work], model="custom:cross-domain-extractor"
+    )
+
+    assert llm.calls == 2
+    repair_prompt = llm.prompts[1][1]
+    assert "Mathematical validation failed" in repair_prompt
+    repair_context = repair_prompt.split("<BEGIN_UNTRUSTED_SOURCE_EVIDENCE>", 1)[0]
+    assert '"evidence": null' in repair_context
+    assert "σ" not in repair_context
+    assert "Never copy Unicode mathematical symbols" in repair_context
+    assert "rewrite U+03C3 as `sigma`" in repair_context
+    assert extracted.items[0].principles[0]["evidence"] == (
+        "Noise scale controls calibration stability."
+    )
+
+
 def test_extraction_allows_genuinely_empty_individual_category(
     tmp_path: Path, monkeypatch: Any
 ) -> None:
```

---

### Incident Patch 12: `1ad7fb66` (2026-07-16)
**Commit Message**: Fix optional parser typing in core CI

**File**: `Principia-v1.3/RELEASE_QA.md` (modified, +3/-3)
```diff
@@ -82,7 +82,7 @@ environment variables pointed to an isolated Node 22 / KaTeX 0.16.22 runtime.
 | `shasum -a 256 -c examples/test*/checksums.sha256` | PASS — all 9 public showcase files match |
 | `python -m build --no-isolation` | PASS — exactly one 1.3.3 wheel and one 1.3.3 sdist |
 | `python -m twine check dist/*` | PASS — both archives |
-| `python scripts/check_release_archive.py dist/*` | PASS — 153 text members and 2,015,172 uncompressed bytes scanned |
+| `python scripts/check_release_archive.py dist/*` | PASS — 153 text members and 2,015,372 uncompressed bytes scanned |
 | clean installed-wheel core smoke | PASS — imports, 14 public interfaces, typing markers, CLI, dependency integrity |
 | clean installed-wheel `[local]` smoke | PASS — DOCX/PPTX/XLSX parsers, 3/3 ingestion, portable URIs, no path leakage |
 
@@ -195,8 +195,8 @@ both GitHub and PyPI.
 
 | Artifact | Bytes | SHA-256 |
 | --- | ---: | --- |
-| `principia_ai-1.3.3-py3-none-any.whl` | 170,905 | `448d2a29568a89020d90095b4748f7f77809beeb149e83d46e4e7369eed8dde0` |
-| `principia_ai-1.3.3.tar.gz` | 317,766 | `d471efadb6a03c83ed2052cf8eb3d7675a93641198457e4997a6e5b2cd0dedd6` |
+| `principia_ai-1.3.3-py3-none-any.whl` | 170,917 | `5414073952a4a26f5f5e8689f9b8268b05405b56505599750ac3e81359007cb7` |
+| `principia_ai-1.3.3.tar.gz` | 317,781 | `78aa4c7173bcb6bf87a7b8fadc2868ed64a6ee25f4c258d2ecbcdc8e105680fb` |
 
 Archive inspection confirmed package metadata version 1.3.3, Python 3.10+
 compatibility, MIT license metadata, `principia` and `principia_retrieval`, both
```

**File**: `Principia-v1.3/src/principia/local_sources.py` (modified, +2/-2)
```diff
@@ -614,7 +614,7 @@ def _parse_text(path: Path, data: bytes) -> ParsedLocalContent:
 
 def _parse_docx(path: Path, data: bytes) -> ParsedLocalContent:
     try:
-        from docx import Document
+        from docx import Document  # type: ignore[import-not-found, import-untyped]
     except ImportError as exc:  # pragma: no cover - depends on optional extra
         raise LocalParserUnavailable(
             "DOCX parsing requires `pip install principia-ai[local]`."
@@ -628,7 +628,7 @@ def _parse_docx(path: Path, data: bytes) -> ParsedLocalContent:
 
 def _parse_pptx(path: Path, data: bytes) -> ParsedLocalContent:
     try:
-        from pptx import Presentation
+        from pptx import Presentation  # type: ignore[import-not-found, import-untyped]
     except ImportError as exc:  # pragma: no cover - depends on optional extra
         raise LocalParserUnavailable(
             "PPTX parsing requires `pip install principia-ai[local]`."
```

---

### Incident Patch 13: `73d57ad4` (2026-07-12)
**Commit Message**: fix bug of web ui of "Clear Local Records"

**File**: `static/app.js` (modified, +0/-5)
```diff
@@ -2537,11 +2537,6 @@ function bindEvents() {
     }
   });
   el("clearRecordsBtn").addEventListener("click", () => {
-    const projectName = state.activeProject?.name || "this project";
-    el("clearRecordsMessage").textContent =
-      state.activeProjectId && state.activeProjectId !== "default"
-        ? `This removes local records from ${projectName}. Records shared with other projects are kept, and the project shell is kept.`
-        : "This removes local works, extracted ideas, principles, takeaways, benchmarks, baselines, generated ideas, run history, evidence links, and v1 memory. Project shells are kept.";
     el("clearRecordsModal").hidden = false;
   });
   el("cancelClearRecordsBtn").addEventListener("click", () => {
```

---

### Incident Patch 14: `e71f0a33` (2026-07-06)
**Commit Message**: fix project-scoped local record clearing

**File**: `principia/engine.py` (modified, +156/-0)
```diff
@@ -1601,6 +1601,162 @@ def cleanup_local_records(self) -> dict[str, Any]:
         self.store.vacuum()
         return {"ok": True, "repaired": repaired}
 
+    def clear_project_local_records(self, field_id: str) -> dict[str, Any]:
+        field_id = str(field_id or "").strip()
+        if not field_id:
+            raise ValueError("Missing field_id")
+        if field_id == "default":
+            raise ValueError("The default project cannot be cleared with project-scoped cleanup.")
+        profile = self.store.get_item("field_profiles", field_id)
+        if not profile:
+            raise KeyError(f"field_profiles:{field_id} not found")
+
+        runs = self.store.list_research_runs_for_field(field_id, limit=10000)
+        for run in runs:
+            if run.get("field_id") == field_id and run.get("status") not in {"complete", "error", "cancelled"}:
+                self.cancel_run(str(run.get("run_id") or ""))
+
+        data_before = self.store.snapshot(limit_per_bucket=None)
+        project_memberships = self.store.list_project_memberships(field_id, include_hidden=True)
+        candidate_records = self._project_record_candidates(data_before, field_id, project_memberships)
+        deleted: dict[str, int] = {}
+
+        deleted_memberships = self.store.delete_project_memberships(field_id)
+        if deleted_memberships:
+            deleted["project_memberships"] = deleted_memberships
+        deleted_runs = self.store.delete_research_runs_for_field(field_id)
+        if deleted_runs:
+            deleted["research_runs"] = deleted_runs
+
+        try:
+            global_deleted = self.global_store.delete_project(field_id, delete_local_data=True)
+            if global_deleted:
+                deleted["v1_memory"] = int(sum(global_deleted.values()))
+        except Exception:
+            deleted["v1_memory_errors"] = deleted.get("v1_memory_errors", 0) + 1
+
+        data_after = self.store.snapshot(limit_per_bucket=None)
+        deleted_refs = self._delete_unreferenced_project_records(field_id, candidate_records, data_after, deleted)
+        for link in data_after.get("evidence_links", {}).values():
+            link_id = str(link.get("link_id") or "")
+            target_ref = (str(link.get("target_bucket") or ""), str(link.get("target_id") or ""))
+            source_ref = ("source_works", str(link.get("source_id") or link.get("source_work_id") or ""))
+            if link.get("field_id") == field_id or target_ref in deleted_refs or source_ref in deleted_refs:
+                if link_id and self.store.get_item("evidence_links", link_id):
+                    self.store.delete_item("evidence_links", link_id)
+                    deleted["evidence_links"] = deleted.get("evidence_links", 0) + 1
+
+        profile = self.store.get_item("field_profiles", field_id) or profile
+        profile["work_ids"] = []
+        profile["principle_ids"] = []
+        profile["idea_ids"] = []
+        profile["refresh_status"] = "idle"
+        profile["updated_at"] = utc_now()
+        self.store.upsert("field_profiles", profile, "field_id")
+        self.store.vacuum()
+        self.global_store.vacuum()
+        return {"ok": True, "field_id": field_id, "deleted": deleted}
+
+    def _project_record_candidates(
+        self,
+        data: dict[str, Any],
+        field_id: str,
+        project_memberships: list[dict[str, Any]],
+    ) -> dict[str, set[str]]:
+        candidate_records: dict[str, set[str]] = {}
+        for membership in project_memberships:
+            bucket = str(membership.get("bucket") or "")
+            record_id = str(membership.get("record_id") or "")
+            if bucket and record_id:
+                candidate_records.setdefault(bucket, set()).add(record_id)
+
+        profile = data.get("field_profiles", {}).get(field_id) or {}
+        legacy_refs = {
+            "work_ids": ("source_works",),
+            "principle_ids": ("principles",),
+            "idea_ids": ("ideas", "my_ideas"),
+        }
+        for key, buckets in legacy_refs.items():
+            for record_id in [str(item) for item in profile.get(key, []) if item]:
+                for bucket in buckets:
+                    candidate_records.setdefault(bucket, set()).add(record_id)
+        for bucket in (
+            "source_works",
+            "principles",
+            "ideas",
+            "work_facts",
+            "benchmark_records",
+            "baseline_records",
+            "result_records",
+            "gap_cards",
+            "existed_ideas",
+            "takeaway_messages",
+            "my_ideas",
+        ):
+            id_key = self._record_id_key(bucket)
+            for item in data.get(bucket, {}).values():
+                record_id = str(item.get(id_key) or "")
+                if record_id and item.get("field_id") == field_id:
+                    candidate_records.setdefault(bucket, set()).add(record_id)
+        return candidate_records
+
+    def _remaining_projec
```

**File**: `principia/server.py` (modified, +3/-0)
```diff
@@ -1046,6 +1046,9 @@ def worker() -> None:
         if path == "/api/v1/local-records/compact":
             return self.engine.compact_local_storage(clear_cloud_cache=bool(payload.get("clear_cloud_cache", True)))
         if path == "/api/v1/local-records/clear":
+            field_id = str(payload.get("field_id") or "").strip()
+            if field_id and field_id != "default":
+                return self.engine.clear_project_local_records(field_id)
             return self.engine.clear_local_records(include_projects=bool(payload.get("include_projects")))
         if path == "/api/v1/project/reorder":
             return {"items": self.engine.reorder_projects([str(item) for item in payload.get("field_ids", [])])}
```

**File**: `static/app.js` (modified, +8/-2)
```diff
@@ -2525,16 +2525,22 @@ function bindEvents() {
     }
   });
   el("clearRecordsBtn").addEventListener("click", () => {
+    const projectName = state.activeProject?.name || "this project";
+    el("clearRecordsMessage").textContent =
+      state.activeProjectId && state.activeProjectId !== "default"
+        ? `This removes local records from ${projectName}. Records shared with other projects are kept, and the project shell is kept.`
+        : "This removes local works, extracted ideas, principles, takeaways, benchmarks, baselines, generated ideas, run history, evidence links, and v1 memory. Project shells are kept.";
     el("clearRecordsModal").hidden = false;
   });
   el("cancelClearRecordsBtn").addEventListener("click", () => {
     el("clearRecordsModal").hidden = true;
   });
   el("confirmClearRecordsBtn").addEventListener("click", async () => {
     try {
-      await post("/api/v1/local-records/clear", {});
+      const payload = state.activeProjectId && state.activeProjectId !== "default" ? { field_id: state.activeProjectId } : {};
+      await post("/api/v1/local-records/clear", payload);
       el("clearRecordsModal").hidden = true;
-      showToast("Local records cleared.");
+      showToast(payload.field_id ? "Project local records cleared." : "Local records cleared.");
       state.assembler.selected = [];
       await loadProjects(state.activeProjectId);
       await loadSummary();
```

**File**: `static/index.html` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ <h2 id="clearRecordsTitle">Clear local records</h2>
           </div>
           <button id="cancelClearRecordsBtn" type="button" class="secondary-btn">Cancel</button>
         </header>
-        <p class="muted">This removes local works, extracted ideas, principles, takeaways, benchmarks, baselines, generated ideas, run history, evidence links, and v1 memory. Project shells are kept.</p>
+        <p id="clearRecordsMessage" class="muted">This removes local records from the selected project. Records shared with other projects are kept, and the project shell is kept.</p>
         <div class="modal-actions">
           <button id="confirmClearRecordsBtn" type="button" class="danger-btn">Clear Local Records</button>
         </div>
```

**File**: `tests/test_principia_v1.py` (modified, +69/-0)
```diff
@@ -2972,6 +2972,75 @@ def test_v2_list_projects_hides_default_and_clear_local_records_keeps_shells(sel
         self.assertEqual(store.counts()["existed_ideas"], 0)
         self.assertGreaterEqual(cleared["deleted"].get("project_memberships", 0), 1)
 
+    def test_v2_clear_project_local_records_keeps_other_project_records(self) -> None:
+        store = self.make_store()
+        engine = PrincipiaEngine(store=store, llm=NoLLM())  # type: ignore[arg-type]
+        left = engine.create_project(name="Left Project", goal_text="left reasoning")
+        right = engine.create_project(name="Right Project", goal_text="right reasoning")
+        shared_work = engine._v2_upsert_work({"work_id": "W-SHARED", "title": "Shared Work", "abstract": "Shared evidence.", "year": 2026}, model_mode="metadata")
+        left_work = engine._v2_upsert_work({"work_id": "W-LEFT", "title": "Left Work", "abstract": "Left evidence.", "year": 2026}, model_mode="metadata")
+        right_work = engine._v2_upsert_work({"work_id": "W-RIGHT", "title": "Right Work", "abstract": "Right evidence.", "year": 2026}, model_mode="metadata")
+        shared_idea = engine._v2_upsert_canonical(
+            "existed_ideas",
+            "shared diagnostic routing",
+            {
+                "title": "Shared Diagnostic Routing",
+                "idea_text": "Use shared diagnostic routing to decide when evidence should alter the reasoning path.",
+                "source_work_ids": [shared_work["work_id"]],
+            },
+            model_mode="efficient",
+        )
+        left_idea = engine._v2_upsert_canonical(
+            "existed_ideas",
+            "left calibration gate",
+            {
+                "title": "Left Calibration Gate",
+                "idea_text": "Use a left-project calibration gate to decide when local evidence should override a default path.",
+                "source_work_ids": [left_work["work_id"]],
+            },
+            model_mode="efficient",
+        )
+        right_idea = engine._v2_upsert_canonical(
+            "existed_ideas",
+            "right verification gate",
+            {
+                "title": "Right Verification Gate",
+                "idea_text": "Use a right-project verification gate to decide when local evidence should override a default path.",
+                "source_work_ids": [right_work["work_id"]],
+            },
+            model_mode="efficient",
+        )
+        engine.add_project_memberships(left["field_id"], "source_works", [shared_work["work_id"], left_work["work_id"]])
+        engine.add_project_memberships(left["field_id"], "existed_ideas", [shared_idea["canonical_id"], left_idea["canonical_id"]])
+        engine.add_project_memberships(right["field_id"], "source_works", [shared_work["work_id"], right_work["work_id"]])
+        engine.add_project_memberships(right["field_id"], "existed_ideas", [shared_idea["canonical_id"], right_idea["canonical_id"]])
+        left_profile = store.get_item("field_profiles", left["field_id"])
+        left_profile["work_ids"] = [shared_work["work_id"], left_work["work_id"]]
+        left_profile["idea_ids"] = []
+        store.upsert("field_profiles", left_profile, "field_id")
+
+        cleared = engine.clear_project_local_records(left["field_id"])
+
+        self.assertIsNotNone(store.get_item("field_profiles", left["field_id"]))
+        self.assertEqual(store.list_project_memberships(left["field_id"], include_hidden=True), [])
+        self.assertEqual(store.get_item("field_profiles", left["field_id"]).get("work_ids"), [])
+        self.assertIsNone(store.get_item("source_works", left_work["work_id"]))
+        self.assertIsNone(store.get_item("existed_ideas", left_idea["canonical_id"]))
+        self.assertIsNotNone(store.get_item("source_works", shared_work["work_id"]))
+        self.assertIsNotNone(store.get_item("existed_ideas", shared_idea["canonical_id"]))
+        self.assertIsNotNone(store.get_item("source_works", right_work["work_id"]))
+        self.assertIsNotNone(store.get_item("existed_ideas", right_idea["canonical_id"]))
+        self.assertEqual(
+            {item["record_id"] for item in store.list_project_memberships(right["field_id"], "source_works")},
+            {shared_work["work_id"], right_work["work_id"]},
+        )
+        self.assertEqual(
+            {item["canonical_id"] for item in engine.build_v2_project_tab(right["field_id"], "existed_ideas", limit=10)["items"]},
+            {shared_idea["canonical_id"], right_idea["canonical_id"]},
+        )
+        self.assertGreaterEqual(cleared["deleted"].get("project_memberships", 0), 4)
+        self.assertEqual(cleared["deleted"].get("source_works", 0), 1)
+
     def test_v2_works_tab_supports_show_more_and_sort_modes(self) -> None:
         store = self.make_store()
         engine = PrincipiaEngine(store=store, llm=NoLLM())  # type: ignore[arg-type]
```

---

### Incident Patch 15: `4cfc3a71` (2026-07-11)
**Commit Message**: Merge pull request #6 from GCXGH/fix/local-openai-compatible-settings

Fix/local OpenAI compatible setImprove local OpenAI-compatible provider configurationtings

**File**: `.env.example` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@ SILICONFLOW_API_KEY=your_siliconflow_key_here
 OPENAI_API_KEY=your_openai_key_here
 PRINCIPIA_LLM_BASE_URL=https://api.siliconflow.cn/v1
 PRINCIPIA_OPENAI_BASE_URL=https://api.openai.com/v1
+PRINCIPIA_OPENAI_GPT55_MODEL=openai:gpt-5.5
+PRINCIPIA_OPENAI_API_STYLE=auto
 PRINCIPIA_REQUEST_TIMEOUT=180
 PRINCIPIA_SLOW_REQUEST_TIMEOUT=420
 PRINCIPIA_COST_LIMIT_CNY=1000
```

**File**: `principia/config.py` (modified, +2/-0)
```diff
@@ -39,6 +39,7 @@ class Settings:
     request_timeout: int
     slow_request_timeout: int
     ssl_verify: bool
+    openai_api_style: str = "auto"
 
     @property
     def llm_available(self) -> bool:
@@ -85,4 +86,5 @@ def get_settings() -> Settings:
         request_timeout=int(os.getenv("PRINCIPIA_REQUEST_TIMEOUT", "180")),
         slow_request_timeout=int(os.getenv("PRINCIPIA_SLOW_REQUEST_TIMEOUT", "420")),
         ssl_verify=os.getenv("PRINCIPIA_SSL_VERIFY", "1").strip().lower() not in {"0", "false", "no"},
+        openai_api_style=os.getenv("PRINCIPIA_OPENAI_API_STYLE", "auto").strip().lower() or "auto",
     )
```

**File**: `principia/llm_client.py` (modified, +12/-1)
```diff
@@ -179,7 +179,7 @@ def chat_text(
         prompt = system + "\n\n" + user
         self.costs.reserve(model, prompt, max_tokens)
         request_timeout = self._request_timeout(resolved, max_tokens, timeout_seconds=timeout_seconds)
-        if resolved["provider"] == "openai" and model.lower().startswith("gpt-5"):
+        if self._use_openai_responses_api(resolved, model):
             return self._openai_responses_text(
                 resolved,
                 system,
@@ -247,6 +247,17 @@ def send(payload_to_send: dict[str, Any]) -> str:
         body = json.loads(raw)
         return body["choices"][0]["message"]["content"]
 
+    def _use_openai_responses_api(self, resolved: dict[str, str], model: str) -> bool:
+        if resolved["provider"] != "openai":
+            return False
+        style = self.settings.openai_api_style
+        if style == "responses":
+            return True
+        if style == "chat_completions":
+            return False
+        official_base = resolved["base_url"].rstrip("/") == "https://api.openai.com/v1"
+        return official_base and model.lower().startswith("gpt-5")
+
     def _openai_responses_text(
         self,
         resolved: dict[str, str],
```

**File**: `principia/server.py` (modified, +28/-0)
```diff
@@ -137,6 +137,24 @@ def _write_env_values(updates: dict[str, str]) -> None:
         os.environ[key] = value
 
 
+def _openai_model_env_value(value: object) -> str:
+    model = str(value or "").strip()
+    if not model:
+        return ""
+    if model.startswith("model:"):
+        model = model.removeprefix("model:")
+    if ":" not in model:
+        model = f"openai:{model}"
+    return model
+
+
+def _display_model_alias(value: str) -> str:
+    text = str(value or "").strip()
+    if text.startswith("openai:") or text.startswith("siliconflow:"):
+        return text.split(":", 1)[1]
+    return text
+
+
 class PrincipiaRequestHandler(BaseHTTPRequestHandler):
     server_version = "Principia/1.0"
     work_extract_lock = threading.Lock()
@@ -324,6 +342,14 @@ def progress_callback(update: dict) -> None:
                     updates["PRINCIPIA_LLM_BASE_URL"] = str(payload.get("siliconflow_base_url") or "").strip()
                 if "openai_base_url" in payload:
                     updates["PRINCIPIA_OPENAI_BASE_URL"] = str(payload.get("openai_base_url") or "").strip()
+                if "openai_model" in payload:
+                    model_value = _openai_model_env_value(payload.get("openai_model"))
+                    if model_value:
+                        updates["PRINCIPIA_OPENAI_GPT55_MODEL"] = model_value
+                if "openai_api_style" in payload:
+                    style = str(payload.get("openai_api_style") or "auto").strip().lower()
+                    if style in {"auto", "chat_completions", "responses"}:
+                        updates["PRINCIPIA_OPENAI_API_STYLE"] = style
                 if updates:
                     _write_env_values(updates)
                     self.engine.llm = LLMClient(get_settings())
@@ -1391,6 +1417,8 @@ def _settings_payload(self) -> dict:
                 "configured": bool(settings.openai_api_key),
                 "masked": _mask_secret(settings.openai_api_key),
                 "base_url": settings.openai_base_url,
+                "model": _display_model_alias(settings.model_aliases.get("openai_gpt55", "")),
+                "api_style": settings.openai_api_style,
             },
             "cost_limit_cny": settings.cost_limit_cny,
             "request_timeout": settings.request_timeout,
```

**File**: `static/app.js` (modified, +17/-1)
```diff
@@ -2129,9 +2129,13 @@ async function confirmDeleteProject() {
 
 async function editApiKeys() {
   const current = await api("/api/settings");
-  el("apiKeysStatus").textContent = `SiliconFlow: ${current.siliconflow?.configured ? current.siliconflow.masked || "configured" : "not configured"} / OpenAI: ${current.openai?.configured ? current.openai.masked || "configured" : "not configured"}. Leave a field blank to keep its current value.`;
+  el("apiKeysStatus").textContent = `SiliconFlow: ${current.siliconflow?.configured ? current.siliconflow.masked || "configured" : "not configured"} / OpenAI: ${current.openai?.configured ? current.openai.masked || "configured" : "not configured"}. Base URLs, model, and API style are saved to .env.`;
   el("siliconflowKeyInput").value = "";
   el("openaiKeyInput").value = "";
+  el("siliconflowBaseUrlInput").value = current.siliconflow?.base_url || "";
+  el("openaiBaseUrlInput").value = current.openai?.base_url || "";
+  el("openaiModelInput").value = current.openai?.model || "";
+  el("openaiApiStyleInput").value = current.openai?.api_style || "auto";
   el("apiKeysModal").hidden = false;
 }
 
@@ -2140,8 +2144,16 @@ async function submitApiKeys(event) {
   const payload = {};
   const silicon = el("siliconflowKeyInput").value.trim();
   const openai = el("openaiKeyInput").value.trim();
+  const siliconBaseUrl = el("siliconflowBaseUrlInput").value.trim();
+  const openaiBaseUrl = el("openaiBaseUrlInput").value.trim();
+  const openaiModel = el("openaiModelInput").value.trim();
+  const openaiApiStyle = el("openaiApiStyleInput").value || "auto";
   if (silicon) payload.siliconflow_api_key = silicon;
   if (openai) payload.openai_api_key = openai;
+  if (siliconBaseUrl) payload.siliconflow_base_url = siliconBaseUrl;
+  if (openaiBaseUrl) payload.openai_base_url = openaiBaseUrl;
+  if (openaiModel) payload.openai_model = openaiModel;
+  payload.openai_api_style = openaiApiStyle;
   if (Object.keys(payload).length) await post("/api/settings", payload);
   el("apiKeysModal").hidden = true;
   el("apiKeysForm").reset();
@@ -2537,6 +2549,10 @@ function bindEvents() {
   el("clearApiKeysFormBtn").addEventListener("click", () => {
     el("siliconflowKeyInput").value = "";
     el("openaiKeyInput").value = "";
+    el("siliconflowBaseUrlInput").value = "";
+    el("openaiBaseUrlInput").value = "";
+    el("openaiModelInput").value = "";
+    el("openaiApiStyleInput").value = "auto";
   });
   el("tabRow").addEventListener("click", async (event) => {
     const button = event.target.closest("[data-tab]");
```

**File**: `static/cloud.js` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ const modelOptions = [
   ["glm", "GLM-5.1 Pro"],
   ["openai_gpt52_pro", "OpenAI GPT-5.2 Pro"],
   ["openai_gpt5_pro", "OpenAI GPT-5 Pro"],
-  ["openai_gpt55", "OpenAI GPT-5.5"],
+  ["openai_gpt55", "OpenAI / Local-compatible"],
   ["openai_gpt55_pro_20260423", "OpenAI GPT-5.5 Pro 2026-04-23"],
 ];
 
```

**File**: `static/idea.html` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ <h1 id="ideaTitle">Loading</h1>
               <option value="glm">GLM-5.1 Pro</option>
               <option value="openai_gpt52_pro">OpenAI GPT-5.2 Pro</option>
               <option value="openai_gpt5_pro">OpenAI GPT-5 Pro</option>
-              <option value="openai_gpt55">OpenAI GPT-5.5</option>
+              <option value="openai_gpt55">OpenAI / Local-compatible</option>
               <option value="openai_gpt55_pro_20260423">OpenAI GPT-5.5 Pro 2026-04-23</option>
             </select>
           </label>
```

**File**: `static/index.html` (modified, +23/-3)
```diff
@@ -85,7 +85,7 @@ <h2 id="projectTitle">Loading</h2>
                 <option value="glm">GLM-5.1 Pro</option>
                 <option value="openai_gpt52_pro">OpenAI GPT-5.2 Pro</option>
                 <option value="openai_gpt5_pro">OpenAI GPT-5 Pro</option>
-                <option value="openai_gpt55">OpenAI GPT-5.5</option>
+                <option value="openai_gpt55">OpenAI / Local-compatible</option>
                 <option value="openai_gpt55_pro_20260423">OpenAI GPT-5.5 Pro 2026-04-23</option>
               </select>
             </label>
@@ -341,7 +341,7 @@ <h3>Context</h3>
                   <option value="glm">GLM-5.1 Pro</option>
                   <option value="openai_gpt52_pro">OpenAI GPT-5.2 Pro</option>
                   <option value="openai_gpt5_pro">OpenAI GPT-5 Pro</option>
-                  <option value="openai_gpt55">OpenAI GPT-5.5</option>
+                  <option value="openai_gpt55">OpenAI / Local-compatible</option>
                   <option value="openai_gpt55_pro_20260423">OpenAI GPT-5.5 Pro 2026-04-23</option>
                 </select>
               </label>
@@ -362,15 +362,35 @@ <h2 id="apiKeysTitle">API Keys</h2>
           </div>
           <button id="cancelApiKeysBtn" type="button" class="secondary-btn">Cancel</button>
         </header>
-        <p id="apiKeysStatus" class="muted">Keys are saved locally in .env. Leave a field blank to keep its current value.</p>
+        <p id="apiKeysStatus" class="muted">Settings are saved locally in .env. Leave secrets blank to keep their current values.</p>
         <label class="full-field">
           <span>SiliconFlow API key</span>
           <input id="siliconflowKeyInput" type="password" autocomplete="off" placeholder="Leave blank to keep current key" />
         </label>
+        <label class="full-field">
+          <span>SiliconFlow base URL</span>
+          <input id="siliconflowBaseUrlInput" type="url" autocomplete="off" placeholder="https://api.siliconflow.cn/v1" />
+        </label>
         <label class="full-field">
           <span>OpenAI API key</span>
           <input id="openaiKeyInput" type="password" autocomplete="off" placeholder="Leave blank to keep current key" />
         </label>
+        <label class="full-field">
+          <span>OpenAI-compatible base URL</span>
+          <input id="openaiBaseUrlInput" type="url" autocomplete="off" placeholder="http://127.0.0.1:1234/v1" />
+        </label>
+        <label class="full-field">
+          <span>OpenAI-compatible model</span>
+          <input id="openaiModelInput" type="text" autocomplete="off" placeholder="qwen2.5-7b-instruct" />
+        </label>
+        <label class="full-field">
+          <span>OpenAI API style</span>
+          <select id="openaiApiStyleInput">
+            <option value="auto">Auto</option>
+            <option value="chat_completions">Chat Completions</option>
+            <option value="responses">Responses</option>
+          </select>
+        </label>
         <div class="modal-actions">
           <button id="clearApiKeysFormBtn" type="button" class="secondary-btn">Clear Fields</button>
           <button type="submit" class="primary-btn">Save Keys</button>
```

#### Recent Merged Pull Requests:
- **PR #42** (2026-09-10): Feat/optimizing generation principles (@CatalpaXtra)
- **PR #40** (2026-09-06): feat: improve research graph visualization (@zhangwei-1999)
- **PR #39** (2026-08-23): v1.4.1: live Cloud status and recoverable publication concurrency (@pzqpzq)
- **PR #38** (2026-08-22): Clarify v1.4.1 launch snapshot counts (@pzqpzq)
- **PR #37** (2026-08-22): Principia v1.4.1: Meta-Principle foundation and unified research workspace (@pzqpzq)
- **PR #21** (2026-08-14): Global Cloud reviewed sync sync:01KZZF9ZJWBEPRKMYQSBGAN5TT (@pzqpzq)
- **PR #20** (2026-08-13): Show direct checked PR handoff for SSH Admin publication (@pzqpzq)
- **PR #19** (2026-08-13): Clarify SSH publication and pending Admin syncs (@pzqpzq)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
