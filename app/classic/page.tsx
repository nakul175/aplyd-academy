import Academy from '../academy';
import { requireChatGPTUser } from '../chatgpt-auth';
export const dynamic = 'force-dynamic';
// The earlier workspace tool (v0.17), kept reachable while the practice loop is the product.
export default async function Classic() {
  await requireChatGPTUser('/classic');
  return <Academy />;
}
