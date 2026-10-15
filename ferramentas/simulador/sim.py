import random, json, sys, statistics as st
from collections import defaultdict

# Parâmetros base (suposições; ver economia/balanceamento.md)
BASE = dict(pL=0.85, pM=0.45, pP=0.35, p_obj=0.55, meta=13, bonus_meta=2,
            pts_leve=1, custo_P=1, ganho_P=2, w_P=2, w_M=1)
OBJ_PTS=[3,3,2,2,3,4,4,3,2,3]

# força + habilidades por país (editável pelo tuning)
PAISES = {
 'EUA': dict(f=6, ab={}),
 'CHN': dict(f=5, ab={}),
 'ITA': dict(f=4, ab={}),
 'ARG': dict(f=3, ab={}),
 'EGI': dict(f=3, ab={}),
 'POR': dict(f=2, ab={}),
 'GRE': dict(f=2, ab={}),
 'URU': dict(f=1, ab={}),
}

def play_game(rng, countries, P, base=BASE, trace=False):
    B = base
    n=len(countries)
    order = sorted(countries, key=lambda c:(P[c]['f'], rng.random()))
    ab = {c:P[c]['ab'] for c in countries}
    pi = {c:float(ab[c].get('inicio',0)) for c in countries}
    coop = {c:rng.uniform(0.35,0.9) for c in countries}
    helped = {c:0 for c in countries}
    veto_used = {c:False for c in countries}
    l1x = {c:False for c in countries}
    pedagio_left = {c:ab[c].get('pedagio',0) for c in countries}
    # baralho: 3 cartas casa por país, mão inicial = casa
    hand = {c:['L','M','P'] for c in countries}
    pile = ['L','M','P']*(8-n)
    rng.shuffle(pile); disc=[]
    def draw():
        nonlocal pile, disc
        if not pile:
            pile, disc = disc, []
            rng.shuffle(pile)
        return pile.pop() if pile else None
    objs = {c:rng.choice(OBJ_PTS) for c in countries}
    trilha=0; crises_res=0
    crisis=None
    resolved_stat=[]
    def close(cr):
        nonlocal trilha, crises_res
        w=cr['w']
        if w>=cr['need']:
            trilha+=5; crises_res+=1; res='R'
        elif w>=1:
            trilha+=3; res='A'
        else:
            trilha=max(0,trilha-2); res='U'
        if res in 'RA':
            for c in cr['helpers']:
                pi[c]+=1; helped[c]+=1
        resolved_stat.append(res)
    for r in range(1,6):
        if r in (1,3,5):
            need = 2 if r==1 else (3 if rng.random()<0.6 else 2)
            crisis=dict(need=need, w=0, helpers=set(), dead=r+1 if r<5 else 5)
        for idx,c in enumerate(order):
            a=ab[c]
            h=hand[c]
            if not h: continue
            remaining = crisis['need']-crisis['w']
            # quantos jogadores ainda jogam antes do prazo
            later_this_round = n-idx-1
            last_chance = (crisis['dead']==r)
            can_help = c not in crisis['helpers']
            choice=None
            wM = B['w_M']*(2 if a.get('peso2') else 1)
            if can_help and remaining>0 and ('M' in h or 'P' in h):
                pm = coop[c]
                finishing = (remaining<= (B['w_P'] if 'P' in h else wM))
                if finishing: pm=0.95
                elif last_chance and remaining> later_this_round*2+ (2 if 'P' in h else wM): pm=0.05
                if rng.random()<pm:
                    if 'P' in h and (remaining>=2 or 'M' not in h) and (pi[c]>=1 or rng.random()<coop[c]):
                        choice='P'
                    elif 'M' in h: choice='M'
                    elif 'P' in h: choice='P'
            if choice is None:
                if 'L' in h: choice='L'
                elif 'M' in h: choice='M'
                else: choice='P'
            h.remove(choice); disc.append(choice)
            carisma = a.get('carisma',0)-a.get('desconf',0)
            if choice=='L':
                p=min(1,B['pL']+carisma)
                if a.get('leve_auto'): p=1
                if rng.random()<p:
                    pi[c]+=B['pts_leve']+a.get('leve_bonus',0)
                    if a.get('leve_bonus1x') and not l1x[c]:
                        pi[c]+=1; l1x[c]=True
            else:
                base_p = B['pM'] if choice=='M' else B['pP']
                p=min(1,base_p+carisma)
                if choice=='P':
                    pi[c]-=B['custo_P']
                ok = rng.random()<p
                if not ok and a.get('veto1') and not veto_used[c]:
                    ok=True; veto_used[c]=True
                if not ok and a.get('voto_extra') and not veto_used[c]:
                    veto_used[c]=True
                    ok = rng.random()<0.5
                if ok:
                    if choice=='P':
                        pi[c]+=B['custo_P']+B['ganho_P']
                    w = wM if choice=='M' else B['w_P']
                    if crisis['dead']>=r:
                        crisis['w']+=w; crisis['helpers'].add(c)
                    # pedágio
                    for d in countries:
                        if d!=c and pedagio_left[d]>0:
                            pi[d]+=1; pedagio_left[d]-=1
                            break
                else:
                    if choice=='P':
                        if a.get('seguro'): pi[c]+=B['custo_P']
                        elif a.get('inflacao'): pi[c]-=1
                        crisis['w']=max(0,crisis['w']-1)
            # repõe mão
            size = 4 if a.get('hand4') else 3
            while len(h)<size:
                x=draw()
                if x is None: break
                h.append(x)
        if crisis and crisis['dead']==r:
            close(crisis); crisis=None
    meta = trilha>=B['meta']
    for c in countries:
        if rng.random()<B['p_obj']:
            pi[c]+=objs[c]+ ab[c].get('obj_bonus',0)
        if meta: pi[c]+=B['bonus_meta']
    best=max((pi[c],helped[c]) for c in countries)
    winners=[c for c in countries if (pi[c],helped[c])==best]
    return dict(order=order,pi=pi,winners=winners,meta=meta,trilha=trilha,res=resolved_stat)

def run(P, N=20000, seed=1, base=BASE):
    rng=random.Random(seed)
    names=list(P)
    app=defaultdict(int); win=defaultdict(float); pis=defaultdict(float)
    posw=defaultdict(float); posn=defaultdict(int); metas=0
    resdist=defaultdict(int)
    for _ in range(N):
        cs=rng.sample(names,5)
        g=play_game(rng,cs,P,base)
        metas+=g['meta']
        for x in g['res']: resdist[x]+=1
        for c in cs:
            app[c]+=1; pis[c]+=g['pi'][c]
        for w in g['winners']: win[w]+=1/len(g['winners'])
        for i,c in enumerate(g['order']):
            posn[i]+=1
            if c in g['winners']: posw[i]+=1/len(g['winners'])
    return dict(
        win={c:win[c]/app[c] for c in names},
        pi={c:pis[c]/app[c] for c in names},
        pos={i:posw[i]/posn[i] for i in range(5)},
        meta=metas/N, res={k:v/ (N*3) for k,v in resdist.items()})

if __name__=='__main__':
    r=run(PAISES)
    print(json.dumps({k:({a:round(b,3) for a,b in v.items()} if isinstance(v,dict) else round(v,3)) for k,v in r.items()},indent=0))
