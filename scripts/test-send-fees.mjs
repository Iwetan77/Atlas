import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/send/send-review.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
const jsx = (type, props) => ({ type, props });
const imports = {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-native': { StyleSheet: { create: value => value }, View: 'View' },
  '@/components/ui/card': { Card: 'Card' }, '@/components/ui/text': { Text: 'Text' },
  '@/components/money-error': {}, '@/components/quote-timer': { QuoteTimer: 'QuoteTimer' },
  '@/format/money': { formatMoney: value => '₦' + Number(value.amount).toFixed(2) },
  '@/theme': { colors: {}, spacing: {} },
};
vm.runInNewContext(compiled, { exports, require: name => imports[name] });
const money = amount => ({ amount: String(amount), currency: 'NGN' });
function rows(networkFee) {
  const quote = { destinationLabel: 'Bank', receive: money(200), fee: money(20),
    send: money(220 + (networkFee ?? 0)), eta: 'Within minutes',
    ...(networkFee === undefined ? {} : { networkFee: money(networkFee) }),
    feeBreakdown: [{ label: 'Bank payout', amount: money(20) }, { label: 'Network delivery', amount: money(30) }],
  };
  const card = exports.SendReview({ quote, quoting: false, error: null, secondsLeft: 20 });
  return JSON.parse(JSON.stringify(card.props.children.filter(child => child?.props?.label).map(child => [child.props.label, child.props.value])));
}
test('reserve-funded bank review shows only the bank fee and a free network fee', () => {
  assert.deepEqual(rows(0), [['To', 'Bank'], ['They get', '₦200.00'], ['Fee', '₦20.00'],
    ['Network fee', 'Free'], ['You pay', '₦220.00'], ['Arrives', 'Within minutes']]);
});
test('new cash spent on network fees is separate and counted once in You pay', () => {
  assert.deepEqual(rows(30).filter(([label]) => ['Fee', 'Network fee', 'You pay'].includes(label)),
    [['Fee', '₦20.00'], ['Network fee', '₦30.00'], ['You pay', '₦250.00']]);
});
test('an older server remains usable without inventing a network charge or exposing fee parts', () => {
  assert.equal(rows(undefined).some(([label]) => /Network|Bank payout/.test(label)), false);
  assert.equal(rows(undefined).find(([label]) => label === 'Fee')[1], '₦20.00');
});
