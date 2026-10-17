# Monopoly Classic Rules Coverage

This checklist is the implementation contract for the authoritative rules engine. `Missing` and `Partial` items must be resolved before claiming completion.

## Core turn flow

- [ ] `Partial` explicit phases: roll, resolve landing, purchase decision, auction, development, trade, end turn. Core phase constants and transitions now exist; integration remains.
- [x] `Complete` deterministic dice injection and production dice source in the rules module.
- [x] `Complete` doubles grant another roll.
- [x] `Complete` three consecutive doubles send the player directly to Jail.
- [x] `Complete` exact perimeter movement and GO salary for dice and card-driven movement, including wrap detection and authoritative GO events.
- [x] `Complete` turn cannot end while an auction or unowned-purchase decision is pending; server starts the required auction.

## Ownership, rent, and development

- [x] `Complete` purchase at the board's authoritative printed price with affordability and phase validation.
- [x] `Complete` auction initiation when an eligible player declines an unowned purchase, with the room auction rule enforced.
- [x] `Complete` color-group monopoly detection and undeveloped monopoly rent doubling.
- [ ] `Partial` official property rent tables are configurable and validated per custom property; actual custom rent arrays are not present in the repository.
- [x] `Complete` railroad rent based on number owned.
- [x] `Complete` utility rent based on dice total and number owned.
- [x] `Complete` houses and hotels with exact five-level progression, hotel conversion, sale values, and finite bank inventory.
- [x] `Complete` even-building rule across a color group and finite bank supply.
- [x] `Complete` bank inventory: 32 houses and 12 hotels, including shortage behavior and bankruptcy recovery.
- [x] `Complete` selling buildings to bank at half price, even-selling, bank inventory return, and hotel-to-four-house conversion when houses are available.
- [x] `Complete` development blocked by mortgaged properties in the group.

## Mortgages and bankruptcy

- [x] `Complete` mortgage for half purchase value.
- [x] `Complete` mortgage repayment with interest, including recorded transfer obligations.
- [x] `Complete` mortgage-transfer rules preserve the mortgage, charge the creditor 10% transfer interest, and retain the later repayment obligation.
- [x] `Complete` bankruptcy to creditor transfers all assets, liquidates buildings, and settles transferred mortgage interest.
- [x] `Complete` bankruptcy to bank clears improvements, returns properties, restores inventory, and queues sequential bank auctions.
- [x] `Complete` elimination, turn cleanup, open-transaction cleanup, and victory after bankruptcy.

## Jail

- [x] `Complete` Jail landing and Go To Jail movement, including dice, card, and custom-board Go To Jail transitions with authoritative phase state.
- [x] `Complete` three-attempt jail release flow in the rules and server path.
- [x] `Complete` doubles release and movement behavior in the rules and server path.
- [x] `Complete` configurable bail.
- [x] `Complete` Get Out of Jail Free card usage and return to deck.
- [x] `Complete` building purchase and sale are blocked while jailed; trade remains permitted by Classic rules and no-rent is configurable.

## Cards and special spaces

- [x] `Complete` Chance and Community Chest detection uses explicit deck metadata on the custom board while preserving existing tile presentation.
- [x] `Complete` configurable 16-card Chance and 16-card Community Chest deck structures with server-side effects.
- [x] `Complete` nearest railroad and utility movement cards.
- [x] `Complete` advance/back/GO TO JAIL card effects.
- [x] `Complete` repairs, fines, birthday, collecting from all players, and bank payments.
- [x] `Complete` retainable Get Out of Jail Free cards in the card-state model.
- [x] `Complete` reshuffle/return lifecycle for drawn cards.
- [x] `Complete` tax spaces use fixed printed values by default and support validated percentage custom rules.

## Auctions

- [x] `Complete` server-authoritative eligible bidder set, disconnect removal, timeout, and eligibility policy.
- [x] `Complete` passing, highest-bid, no-bid, and disconnect resolution paths are covered by tests.
- [x] `Complete` opening bid may be any positive amount, including below printed price, with valid minimum increments configurable.
- [x] `Complete` bidder affordability and disconnect handling.
- [x] `Complete` no-bid close and server-authoritative auction timeout behavior.
- [x] `Complete` auction cannot conflict with turn/end-turn state.

## Trading

- [x] `Complete` server-authoritative offer validation, including stale revisions and atomic checks.
- [x] `Complete` property-for-property and property-for-cash.
- [x] `Complete` multi-property, two-way cash, card, and configurable mortgage trades.
- [x] `Complete` two-panel trade builder using actual owned assets and board metadata.
- [x] `Complete` counteroffer versioning and invalidation of prior acceptance.
- [x] `Complete` cancel, reject, counteroffer, completion, and expiry notifications with authoritative stale-offer invalidation.
- [x] `Complete` atomic transfer of all assets and cards.

## Presentation and verification

- [ ] `Partial` synchronized token movement and sound effects.
- [x] `Complete` event-specific purchase, auction, trade, card, jail, payment, GO, Vacation, and victory effects through authoritative event IDs.
- [ ] `Missing` rules-engine unit tests for every item above, including edge cases.
- [ ] `Partial` production build and multiplayer state synchronization verification.
