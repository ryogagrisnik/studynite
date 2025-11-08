// lib/banks/index.ts
import quantJson from '@/content/bank.json' assert { type: 'json' };
import * as greBank from '@/lib/greBank';
import { GMAT_QUESTIONS } from '@/lib/gmatBank';
import type { Exam } from '@/lib/types';

const quantJsonData = quantJson as unknown;

const greQuantBank: any[] =
  Array.isArray(quantJsonData)
    ? (quantJsonData as any[])
    : (typeof quantJsonData === 'object' &&
        quantJsonData !== null &&
        Array.isArray((quantJsonData as any).questions)
      ? ((quantJsonData as any).questions as any[])
      : []);

const gmatQuantBank: any[] = Array.isArray(GMAT_QUESTIONS) ? GMAT_QUESTIONS : [];

export const quantBanksByExam: Record<Exam, any[]> = {
  GRE: greQuantBank,
  GMAT: gmatQuantBank,
};

export const quantBank = greQuantBank;

export function getQuantBank(exam: Exam): any[] {
  return quantBanksByExam[exam] ?? [];
}

export const verbalBank: any[] =
  Array.isArray((greBank as any).GRE_QUESTIONS)
    ? (greBank as any).GRE_QUESTIONS
    : (Array.isArray((greBank as any).default) ? (greBank as any).default : []);

export function fewshotQuant(exam: Exam, topic?: string, n=3) {
  const bank = getQuantBank(exam);
  const pool = topic
    ? bank.filter(q => String(q.topic ?? q.category ?? q.concept ?? '').toLowerCase() === String(topic).toLowerCase())
    : bank;
  return pool.slice(0, n);
}
export function fewshotVerbal(concept?: string, n=3) {
  const tgt = (concept ?? '').toUpperCase();
  const pool = tgt
    ? verbalBank.filter((q:any) => String(q.type ?? q.topic ?? '').toUpperCase() === tgt)
    : verbalBank;
  return pool.slice(0, n);
}
export const pickOne = <T,>(arr: T[]) => arr[Math.floor(Math.random()*arr.length)];
