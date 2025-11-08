import { normalizeQuestionPayload } from '../lib/normalizeQuestionPayload';

const explanation = `To determine the relationship between Quantity A and Quantity B, we first analyze the condition for x. Since 3x + 5 is even, 3x must also be odd (as an odd number plus an odd number results in an even number). This implies that x must be an odd integer. The smallest odd positive integer is 1, so let's \textit{start with} x = 1. Then, we have:

\begin{align*}
\text{For } x = 1: &\ 3(1) + 5 = 8 \text{ (even)}\\
2y - 7 &= 3(1)\\
2y - 7 &= 3\\
2y &= 10\\
y &= 5 \text{ (smallest positive integer)}
\end{align*}

Quantity A: x + y = 1 + 5 = 6\\
Quantity B: 2x + 3y = 2(1) + 3(5) = 17\\
Thus, 6 < 17. Therefore, Quantity A is less than Quantity B.

We can also check for other odd integers for x, but they will yield larger values for y, confirming that Quantity A remains less than Quantity B.
\text{Thus, the answer is: Quantity A < Quantity B.}`;

const payload = normalizeQuestionPayload({ question: { section: 'Quant', explainHTML: explanation } });
console.log(payload.explainHTML);
