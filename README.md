# Philosophy Fun

A multidimensional philosophy worldview test and matching app.

## Alpha scope

The current alpha implements the frozen Questionnaire v0.2 with four forms:

- Quick: 46 items
- Standard: 107 items
- Complete: 201 items
- Advanced: 291 items

Results keep four channels distinct:

1. broad worldview continua,
2. restricted continua,
3. categorical position affinities,
4. philosophical methods.

There is no public overall philosopher-match percentage. Restricted continua do not enter the common retrieval ordering. Philosopher categorical matching uses mean-centered cosine similarity; missing, unknown, contested, or inapplicable profile dimensions are handled separately from substantive disagreement.

The runtime includes 100 philosopher profiles and 46 tradition profiles. Tradition profiles are distributions/ranges, with multistrand structures where needed.

## Local development

```bash
npm install
npm run dev
```

Run the full alpha QA gate with:

```bash
npm run qa
```

That command runs unit/synthetic tests and then a production TypeScript/Vite build. GitHub Actions runs the same gate on pushes and pull requests.

## Validation status

This is a pre-pilot research alpha. The questionnaire has not yet been psychometrically calibrated, and philosopher/tradition coding has not yet received external expert validation. Automated QA checks implementation invariants; it is not a substitute for human validation.
