import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'decors.spec.ts',timeout:120000,workers:1,
 use:{baseURL:process.env.DECORS_TEST_URL??'http://127.0.0.1:5189',viewport:{width:1440,height:900},deviceScaleFactor:0.5,channel:'chrome',
 launchOptions:{args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']},
 screenshot:'only-on-failure'},
 webServer:process.env.DECORS_TEST_URL?undefined:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --mode e2e --port 5189 --strictPort',
 url:'http://127.0.0.1:5189',reuseExistingServer:false,timeout:120000},
});
