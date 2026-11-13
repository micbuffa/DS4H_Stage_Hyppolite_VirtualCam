import './decors.css';
import { createDecorEditor } from './app/createDecorEditor';
const canvas=document.querySelector<HTMLCanvasElement>('#decor-canvas');
const host=document.querySelector<HTMLElement>('#decor-app');
if(!canvas||!host)throw new Error('Interface de décors absente.');
try {
  const app=createDecorEditor(canvas,host);
  import.meta.hot?.dispose(()=>app.dispose());
} catch(error) {
  document.querySelector('#decor-status')!.textContent=error instanceof Error?error.message:'Impossible de démarrer WebGL2.';
}
