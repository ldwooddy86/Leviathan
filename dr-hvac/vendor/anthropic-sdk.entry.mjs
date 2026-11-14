/* The official Anthropic TypeScript SDK, cut down to what Dr. HVAC calls: the Messages API (stable and beta, streaming)
   and the Models API. Built from the package's own sub path exports (client, resources, error), so every request, retry,
   stream parser and typed error is the SDK's own code. tools/vendor.mjs bundles this entry into anthropic-sdk.min.js. */
import { BaseAnthropic } from '@anthropic-ai/sdk/client';
import { Messages } from '@anthropic-ai/sdk/resources/messages/messages';
import { Messages as BetaMessages } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { Models } from '@anthropic-ai/sdk/resources/models';
import * as Errors from '@anthropic-ai/sdk/error';

export class Client extends BaseAnthropic {
  constructor(opts) {
    super(opts);
    this.messages = new Messages(this);
    this.beta = { messages: new BetaMessages(this) };
    this.models = new Models(this);
  }
}
export { Errors };
export const VERSION = __SDK_VERSION__;
