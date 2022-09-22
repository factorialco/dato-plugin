# Factorial Dato Plugin

## How to run this repo locally

1 - Install yarn dependencies

```
yarn
```

2 - Run the server

```
yarn run start
```

## Env

```
REACT_APP_VALIDATE_ENDPOINT -> /api/form_campaign/validate (webpage)

REACT_APP_VALIDATE_BATCH_ENDPOINT -> /api/form_campaign/validate-batch (webpage)
```


## Description

This plugin adds the following functionality.

## Forms

- Adds a "Forms" tab to the Top Menu that can be used to access "Form related" tools.
  - The first tool `Campaign Search` allows users to search `Lead Generation Form` Models that contain a specific `marketing_form_campaign` value.
  - The second tool `Issue Scanner`, goes through all the `Lead Generation Form` Models checking for some common issues.
- Adds a small validation when modifying a `marketing_form_campaign` field to try to avoid invalid values.

The plugin can be easily extended to further tailor to the Factorial needs.

## References

[More information about the Dato Plugin SDK](https://www.datocms.com/docs/plugin-sdk)

[Configuring plugin to test inside Dato](https://www.datocms.com/docs/plugin-sdk/build-your-first-plugin)
