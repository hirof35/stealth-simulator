// 形状を定義するための構造体
interface Point { x: number; y: number; }
interface LineSegment { p1: Point; p2: Point; }

class StealthSimulator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // UI要素
  private shapeSelect: HTMLSelectElement;
  private angleSlider: HTMLInputElement;
  private absSlider: HTMLInputElement;
  private angleVal: HTMLElement;
  private absVal: HTMLElement;
  private rcsValue: HTMLElement;

  // シミュレーションパラメータ
  private radarAngle: number = 0;
  private absorption: number = 0.5;
  private currentShape: string = 'conventional';
  private center: Point = { x: 400, y: 250 }; // 機体の中心座標

  constructor() {
    this.canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    this.shapeSelect = document.getElementById('shapeSelect') as HTMLSelectElement;
    this.angleSlider = document.getElementById('radarAngle') as HTMLInputElement;
    this.absSlider = document.getElementById('absorption') as HTMLInputElement;
    this.angleVal = document.getElementById('angleVal')!;
    this.absVal = document.getElementById('absVal')!;
    this.rcsValue = document.getElementById('rcsValue')!;

    this.initEvents();
    this.animate();
  }

  private initEvents() {
    this.shapeSelect.addEventListener('change', () => {
      this.currentShape = this.shapeSelect.value;
    });
    this.angleSlider.addEventListener('input', () => {
      this.radarAngle = parseInt(this.angleSlider.value);
      this.angleVal.innerText = this.radarAngle.toString();
    });
    this.absSlider.addEventListener('input', () => {
      this.absorption = parseInt(this.absSlider.value) / 100;
      this.absVal.innerText = this.absSlider.value;
    });
  }

  // 機体の形状データを取得（簡易的な線分の集合として定義）
  private getAircraftSegments(): LineSegment[] {
    const rawPoints: Point[] = [];
    const scale = 1.2;

    if (this.currentShape === 'conventional') {
      // 従来型戦闘機（デルタ翼・尾翼的な凹凸多め）
      rawPoints.push({ x: 0, y: -80 });   // 機首
      rawPoints.push({ x: 30, y: -20 });
      rawPoints.push({ x: 90, y: 40 });   // 右主翼端
      rawPoints.push({ x: 20, y: 40 });
      rawPoints.push({ x: 30, y: 80 });   // 右尾翼
      rawPoints.push({ x: 0, y: 60 });    // 後部中央
      rawPoints.push({ x: -30, y: 80 });  // 左尾翼
      rawPoints.push({ x: -20, y: 40 });
      rawPoints.push({ x: -90, y: 40 });  // 左主翼端
      rawPoints.push({ x: -30, y: -20 });
    } else if (this.currentShape === 'faceted') {
      // 多面体ステルス（極端な直線のみ）
      rawPoints.push({ x: 0, y: -90 });   // 鋭利な機首
      rawPoints.push({ x: 70, y: 30 });   // 右翼端
      rawPoints.push({ x: 20, y: 50 });   // 後部へ絞る
      rawPoints.push({ x: 0, y: 20 });    // お尻のV字内側
      rawPoints.push({ x: -20, y: 50 });
      rawPoints.push({ x: -70, y: 30 });  // 左翼端
    } else {
      // 全翼機（B-2的なブーメラン型・平行アライメント）
      rawPoints.push({ x: 0, y: -60 });   // 機首
      rawPoints.push({ x: 100, y: 30 });  // 右前縁
      rawPoints.push({ x: 70, y: 60 });   // 右後縁外
      rawPoints.push({ x: 40, y: 35 });   // W型ノッチ1
      rawPoints.push({ x: 0, y: 50 });    // センター後部
      rawPoints.push({ x: -40, y: 35 });
      rawPoints.push({ x: -70, y: 60 });  // 左後縁外
      rawPoints.push({ x: -100, y: 30 }); // 左前縁
    }

    // スケールと位置の適用
    const points = rawPoints.map(p => ({
      x: p.x * scale + this.center.x,
      y: p.y * scale + this.center.y
    }));

    // ループする線分を作成
    const segments: LineSegment[] = [];
    for (let i = 0; i < points.length; i++) {
      segments.push({
        p1: points[i],
        p2: points[(i + 1) % points.length]
      });
    }
    return segments;
  }

  // レイと線分の交点計算
  private checkIntersection(rayP1: Point, rayP2: Point, seg: LineSegment) {
    const r_px = rayP1.x, r_py = rayP1.y;
    const r_dx = rayP2.x - rayP1.x, r_dy = rayP2.y - rayP1.y;
    const s_px = seg.p1.x, s_py = seg.p1.y;
    const s_dx = seg.p2.x - seg.p1.x, s_dy = seg.p2.y - seg.p1.y;

    const rMag = Math.sqrt(r_dx*r_dx + r_dy*r_dy);
    const sMag = Math.sqrt(s_dx*s_dx + s_dy*s_dy);
    if(r_dx/rMag === s_dx/sMag && r_dy/rMag === s_dy/sMag) return null;

    const T2 = (r_dx*(s_py-r_py) + r_dy*(r_px-s_px))/(s_dx*r_dy - s_dy*r_dx);
    const T1 = (s_px + s_dx*T2 - r_px)/r_dx;

    if(T1 < 0 || T2 < 0 || T2 > 1) return null;

    return {
      x: r_px + r_dx * T1,
      y: r_py + r_dy * T1,
      param: T1
    };
  }

  private animate = () => {
    this.render();
    requestAnimationFrame(this.animate);
  }

  private render() {
    // 画面クリア
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. レーダー発信源の描画
    const radarSource: Point = { x: 400, y: 30 };
    this.ctx.fillStyle = '#4caf50';
    this.ctx.beginPath();
    this.ctx.arc(radarSource.x, radarSource.y, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // 2. 機体の描画
    const segments = this.getAircraftSegments();
    this.ctx.strokeStyle = '#888';
    this.ctx.lineWidth = 3;
    this.ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
    this.ctx.beginPath();
    this.ctx.moveTo(segments[0].p1.x, segments[0].p1.y);
    for (let seg of segments) {
      this.ctx.lineTo(seg.p2.x, seg.p2.y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // 3. レーダー波（レイ）のシミュレーション
    const numRays = 40;
    const spread = 240; // 照射の幅
    let totalReturnEnergy = 0;

    // レーダー角度ベクトル
    const rad = (this.radarAngle * Math.PI) / 180;
    
    for (let i = 0; i < numRays; i++) {
      const offsetX = ((i / (numRays - 1)) - 0.5) * spread;
      
      // 照射角に応じてスタート位置をずらす
      const rayStart: Point = {
        x: radarSource.x + offsetX * Math.cos(rad),
        y: radarSource.y + offsetX * Math.sin(rad)
      };

      // レイの進行方向（真下に向かって角度を適用）
      const rayEnd: Point = {
        x: rayStart.x - Math.sin(rad) * 500,
        y: rayStart.y + Math.cos(rad) * 500
      };

      // 最も近い衝突点を探索
      let closestIntersect: any = null;
      let hitSegment: LineSegment | null = null;

      for (let seg of segments) {
        const intersect = this.checkIntersection(rayStart, rayEnd, seg);
        if (intersect) {
          if (!closestIntersect || intersect.param < closestIntersect.param) {
            closestIntersect = intersect;
            hitSegment = seg;
          }
        }
      }

      // レイの描画
      this.ctx.lineWidth = 1;
      if (closestIntersect && hitSegment) {
        // 入射波
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(rayStart.x, rayStart.y);
        this.ctx.lineTo(closestIntersect.x, closestIntersect.y);
        this.ctx.stroke();

        // 反射ベクトルの計算
        const dx = hitSegment.p2.x - hitSegment.p1.x;
        const dy = hitSegment.p2.y - hitSegment.p1.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const normal = { x: -dy / len, y: dx / len }; // 面の法線

        const incoming = { x: rayEnd.x - rayStart.x, y: rayEnd.y - rayStart.y };
        const inLen = Math.sqrt(incoming.x*incoming.x + incoming.y*incoming.y);
        incoming.x /= inLen; incoming.y /= inLen;

        const dot = incoming.x * normal.x + incoming.y * normal.y;
        const reflect = {
          x: incoming.x - 2 * dot * normal.x,
          y: incoming.y - 2 * dot * normal.y
        };

        const reflectEnd = {
          x: closestIntersect.x + reflect.x * 150,
          y: closestIntersect.y + reflect.y * 150
        };

        // レーダー発信源へ戻っているかの判定（簡易判定）
        const toRadar = { x: radarSource.x - closestIntersect.x, y: radarSource.y - closestIntersect.y };
        const toRadarLen = Math.sqrt(toRadar.x*toRadar.x + toRadar.y*toRadar.y);
        toRadar.x /= toRadarLen; toRadar.y /= toRadarLen;

        const returnDot = reflect.x * toRadar.x + reflect.y * toRadar.y;
        const isReturning = returnDot > 0.95; // ほぼ発信源に戻っている

        // 反射波のエネルギー（RAMによる減衰）
        const energy = 1 - this.absorption;

        if (isReturning) {
          this.ctx.strokeStyle = `rgba(255, 0, 0, ${energy})`;
          this.ctx.lineWidth = 2;
          totalReturnEnergy += energy;
        } else {
          this.ctx.strokeStyle = `rgba(0, 150, 255, ${energy * 0.4})`;
        }

        this.ctx.beginPath();
        this.ctx.moveTo(closestIntersect.x, closestIntersect.y);
        this.ctx.lineTo(reflectEnd.x, reflectEnd.y);
        this.ctx.stroke();

      } else {
        // どこにも当たらなかった電波
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
        this.ctx.beginPath();
        this.ctx.moveTo(rayStart.x, rayStart.y);
        this.ctx.lineTo(rayEnd.x, rayEnd.y);
        this.ctx.stroke();
      }
    }

    // 4. RCSの簡易計算と表示の更新
    // 戻ってきたエネルギーの総量に基づいてRCS（仮想値）を決定
    let baseRCS = this.currentShape === 'conventional' ? 5.0 : this.currentShape === 'faceted' ? 0.05 : 0.005;
    let calculatedRCS = baseRCS * (1 + totalReturnEnergy * 2) * (1 - this.absorption);
    if (calculatedRCS < 0.0001) calculatedRCS = 0.0001;

    this.rcsValue.innerText = calculatedRCS.toFixed(4);
  }
}

// 起動
window.addEventListener('DOMContentLoaded', () => {
  new StealthSimulator();
});