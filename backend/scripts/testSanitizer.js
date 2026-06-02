import { sanitizeQuestion } from '../utils/questionSanitizer.js';

const tests = [
  ['hi', false],
  ['HHHEEEllooooo', false],
  ['hellooooooo world', false],
  ['Hey!!!', false],
  ['Hello, when does the internship start?', true],
  ['what is the stipend for VINS?', true],
  ['ok', false],
  ['AAAAAAA', false],
  ['lol', false],
  ['Can I join if I am in 2nd year?', true],
  ['hi there, what are the eligibility criteria for the VINS internship?', true],
  ['Heyyyy, is the certificate digitally signed?', true],
];

let pass = 0;
for (const [input, expectedValid] of tests) {
  const r = sanitizeQuestion(input);
  const ok = r.valid === expectedValid;
  if (ok) pass++;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`[${status}] input="${input.slice(0,45)}" valid=${r.valid} cleaned="${(r.cleaned||'').slice(0,40)}" reason="${(r.reason||'').slice(0,50)}"`);
}

console.log(`\nResult: ${pass}/${tests.length} passed`);
