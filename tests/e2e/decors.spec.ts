import { expect, test } from '@playwright/test';
import { createPreset, parseDocument } from '../../src/domain/decors/decorDocument';
test.beforeEach(async({page})=>{
 await page.goto('/decors.html',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#decor-status')).toContainText('Prêt',{timeout:55000});
});
test('rendu WebGL, variantes et conservation des ajouts',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.locator('#objects option')).toHaveCount(6);
 await page.locator('[data-add="speaker"]').click();
 await expect(page.locator('#selection-name')).toHaveText('Enceinte');
 await page.locator('#preset').selectOption('compact');
 await expect(page.locator('#objects option')).toHaveCount(5);
 await page.locator('#preset').selectOption('festival');
 await expect(page.locator('#objects option')).toHaveCount(7);
 await expect(page.locator('#decor-canvas')).toBeVisible();
 expect(errors).toEqual([]);
});
test('modifier, dupliquer, sauvegarder et restaurer après rechargement',async({page})=>{
 await page.locator('[data-add="speaker"]').click();
 await page.locator('#position0').fill('9');await page.locator('#position0').press('Tab');
 await page.locator('#scale0').fill('1.5');await page.locator('#scale0').press('Tab');
 await page.locator('#duplicate').click();
 await expect(page.locator('#position0')).toHaveValue('11');
 await page.locator('#save').click();
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#decor-status')).toContainText('Prêt',{timeout:55000});
 await page.locator('#restore').click();await expect(page.locator('#objects option')).toHaveCount(8);
 await page.locator('#objects').selectOption({index:7});
 await expect(page.locator('#position0')).toHaveValue('11');await expect(page.locator('#scale0')).toHaveValue('1.5');
 await page.locator('#delete').click();await expect(page.locator('#objects option')).toHaveCount(7);
});
test('export réimport et erreur de fichier sans perte de la scène',async({page})=>{
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
 const stream=await download.createReadStream();const chunks:Buffer[]=[];
 for await (const chunk of stream!)chunks.push(Buffer.from(chunk));
 const data=Buffer.concat(chunks);expect(parseDocument(data.toString()).objects).toHaveLength(6);
 await page.locator('#import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":42}')});
 await expect(page.locator('#decor-status')).toHaveAttribute('data-state','error');
 await expect(page.locator('#objects option')).toHaveCount(6);
 await page.locator('#import').setInputFiles({name:'compact.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(createPreset('compact')))});
 await expect(page.locator('#objects option')).toHaveCount(4);
});
test('spots et manipulation visible dans le navigateur',async({page},testInfo)=>{
 await page.locator('#objects').selectOption('lamp-0');
 await expect(page.locator('#light-controls')).toBeVisible();
 await page.locator('#beam').uncheck();
 await page.locator('#intensity').evaluate((e:HTMLInputElement)=>{e.value='0';});await page.locator('#intensity').dispatchEvent('change');
 await page.locator('[data-tool="rotate"]').click();
 await expect(page.locator('[data-tool="rotate"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#rotation1').fill('45');await page.locator('#rotation1').press('Tab');
 await expect(page.locator('#rotation1')).toHaveValue('45');
 await page.locator('[data-tool="move"]').click();
 await page.locator('#objects').selectOption('screen-0');
 await page.screenshot({path:testInfo.outputPath('atelier-decors.png'),fullPage:true});
});

test('déplacement réel avec le gizmo et désélection par Échap',async({page})=>{
 test.setTimeout(180000);
 await page.locator('#objects').selectOption('screen-0');
 const initial=await page.locator('#position0').inputValue();
 const canvas=await page.locator('#decor-canvas').boundingBox();
 expect(canvas).not.toBeNull();
 // Coordinates correspond to the X handle in the reviewed 1440px desktop view.
 const x=canvas!.x+170,y=canvas!.y+353;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+65,y,{steps:2});await page.mouse.up();
 await expect(page.locator('#position0')).not.toHaveValue(initial);
 const committed=await page.locator('#position0').inputValue();
 await page.locator('#objects').selectOption('screen-0');
 await page.keyboard.press('Escape');
 await expect(page.locator('#selection-name')).toHaveText('Aucun décor sélectionné');
 await page.locator('#objects').selectOption('screen-0');
 await expect(page.locator('#position0')).toHaveValue(committed);
});
