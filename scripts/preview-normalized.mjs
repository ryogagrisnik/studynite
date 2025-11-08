import { normalizeQuestionPayload } from '../lib/normalizeQuestionPayload';

const explanation = `To find the area of the circle, we use the formula for the area of a circle, which is given by: ext{Area} = ext{π}r^(2). Substituting the radius (r = 3): ext{Area} = ext{π}(3^2) = 9 ext{π}. For the square, the area is calculated using the formula: ext{Area} = s^(2), where s is the side length. Thus, the area of the square is: ext{Area} = 5^2 = 25. Now, we compare 9π and 25. Since π is approximately 3.14, we find that 9π is approximately 28.26, which is greater than 25.

Therefore, Quantity A is greater than Quantity B.

Key steps: Identify what’s being asked, set up equations using given relationships, simplify carefully, and check edge cases.`;

const payload = normalizeQuestionPayload({ question: { section: 'Quant', explainHTML: explanation } });
console.log(payload.explainHTML);
