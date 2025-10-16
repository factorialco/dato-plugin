# DatoCMS Plugin

A custom DatoCMS plugin that provides form management and validation tools.

## How to run this repo locally

1 - Install yarn dependencies

```
yarn
```

2 - Configure your environment variables in `.env` file by using `.env.example`

3 - Run the server

```
yarn run start
```

## Description

This plugin adds the following functionality.

### Forms

- Adds a "Forms" tab to the Top Menu that can be used to access "Form related" tools.
  - The first tool `Campaign Search` allows users to search `Lead Generation Form` Models that contain a specific `marketing_form_campaign` value.
  - The second tool `Issue Scanner`, goes through all the `Lead Generation Form` Models checking for some common issues.
- Adds a small validation when modifying a `marketing_form_campaign` field to try to avoid invalid values. 

The plugin can be easily extended to further tailor to the Factorial needs.

#### Known limitations
- This is not a true validation, the plugin has no way to prevent the user from saving. This may change in the future with updates to the Dato Plugin SDK.
- The validation does not work when the modal is closed right after saving. This is specially a problem because some DatoCMS views close by default after saving.

### Landing Page Alert
Adds an alert for Demo Landing Page model in case the limits of variant are exceeded.

## References

[More information about the Dato Plugin SDK](https://www.datocms.com/docs/plugin-sdk)

[Configuring plugin to test inside Dato](https://www.datocms.com/docs/plugin-sdk/build-your-first-plugin)
