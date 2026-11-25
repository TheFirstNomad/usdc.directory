# MetaMask "Malicious site" warning on usdc.directory

## What the warning is
MetaMask's built-in security partner (Blockaid) put usdc.directory on its warning list. This is a reputation label on the domain, not proof of an attack. Likely triggers: a new domain that contains a big brand name ("USDC"), wallet signature requests on admin pages, and recent DNS and proxy changes.

The app itself does not ask for token approvals, unlimited spending, or permit signatures. Payments are a fixed 1 USDC transfer to the treasury, and the admin pass is a plain text signature that cannot move funds.

## Steps
1. **Check for real tampering.** Load the live site and compare its scripts with the project's own build. Look for unknown third-party scripts or wallet calls (approve, permit, setApprovalForAll), and look for DNS records or proxy routes that should not be there.
2. **Check that wallet requests are safe.** Confirm every payment and signature request in the code is limited to a fixed USDC transfer or a readable text message, with no approvals.
3. **Reduce what triggers the warning.** Make the admin sign-in message clearly name usdc.directory, the purpose and an expiry. Show the payment amount and treasury address on screen before every payment.
4. **Ask for removal from the list.** Prepare ready-to-send false-positive reports for Blockaid (report.blockaid.io), MetaMask's phishing-detect list on GitHub, and Brave, with the domain, a description and proof of ownership.
5. **Report back** with what was found and what you need to submit.

## Until it is cleared
Users who accept the warning are not at risk from a fixed 1 USDC transfer, but many will leave. Do not tell users to ignore wallet warnings in general.
