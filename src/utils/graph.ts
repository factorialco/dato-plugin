import { ItemType } from "datocms-plugin-sdk";

export const snakeToCamelObject = (obj: any): any => {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item: any) => snakeToCamelObject(item as any));
  }

  const camelObj = {} as any;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const camelKey =
        key === "__typename"
          ? "__typename"
          : key.replace(/_([a-z])/g, (match, group) => group.toUpperCase());
      camelObj[camelKey] = snakeToCamelObject(obj[key]);
    }
  }

  return camelObj;
};

export const snakeToCamel = (name: string, firstUpperCase?: boolean) => {
  if (firstUpperCase) {
    return name.replace(/(?:^|_)(.)/g, (_, group1) => group1.toUpperCase());
  }

  return name.replace(/_([a-z])/g, (match, group) => group.toUpperCase());
};

export const getTypename = (
  itemTypes: Partial<Record<string, ItemType>>,
  id: string
): string => {
  const record = itemTypes[id]?.attributes?.api_key;

  if (record) {
    return `${snakeToCamel(record, true)}Record`;
  }

  return "";
};

const checksum = (s: string) => {
  var chk = 0x12345678;
  var len = s.length;
  for (var i = 0; i < len; i++) {
    chk += s.charCodeAt(i) * (i + 1);
  }

  return (chk & 0xffffffff).toString(16);
};

const localRequestStore = {} as any;

export const fetchRequest = async (query: string, child?: string) => {
  const queryHash = checksum(query);

  if (localRequestStore[queryHash]) {
    return new Promise((resolve) => {
      resolve(localRequestStore[queryHash]);
    });
  }

  if(!process.env.DATOCMS_KEY) {
    console.error('NO DATOKEY FOUND IN ENV VARS')
  }

  return fetch("https://graphql.datocms.com", {
    method: "POST",
    headers: {
      Authorization: process.env.DATOCMS_KEY || "",
    },
    body: JSON.stringify({
      query,
    }),
  })
    .then((res) => res.json())
    .then((res) => {
      localRequestStore[queryHash] = child ? res.data[child] : res.data;

      return localRequestStore[queryHash];
    });
};

const imageSchema = `
id
alt
url
title
responsiveImage {
  src
  srcSet
  aspectRatio
  width
  height
  alt
  title
}`;

export const fetchMedia = (id: string, name?: string) => {
  if (!id) {
    return null;
  }
  return fetchRequest(
    `query {
        upload(filter: {id: {eq: "${id}"}}) {
          ${imageSchema}
        }
      }`,
    name || "upload"
  );
};

export const fetchVideo = (id: string, name?: string) => {
  return fetchRequest(
    `query {
        upload(filter: {id: {eq: "${id}"}}) {
          id
          format
          url
          video {
            streamingUrl
          }
        }
      }`,
    name || "upload"
  );
};

export const fetchCertificatesRecord = async (
  ids: [string],
  locale: string
) => {
  const request = await fetchRequest(
    `query {
      allCertificates(locale: ${
        locale || "en"
      }, filter: {id: {in: ${JSON.stringify(ids)}}}) {
          id
          certificate {
            ${imageSchema}
          }
        }
      }`,
    "allCertificates"
  );

  return ids.map((e) => request.find((r: any) => r.id === e));
};

export const fetchBadgeRecord = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allBadges(locale: ${locale || "en"}, filter: {id: {in: ${JSON.stringify(
      ids
    )}}}) {
        color
        id
        name
      }
    }`,
    "allBadges"
  );

  return ids.map((e) => request?.find((r: any) => r.id === e));
};

export const fetchCompetitorCard = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allCompetitorCards(locale: ${
        locale || "en"
      }, filter: {id: {in: ${JSON.stringify(ids)}}}) {
        id
        competitor
        link {
          slug
        }
      }
    }`,
    "allCompetitorCards"
  );
  return ids.map((e) => request?.find((r: any) => r.id === e));
};

export const fetchIconBlock = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allIconBlocks(locale: ${
        locale || "en"
      }, filter: {id: {in: ${JSON.stringify(ids)}}}) {
        id
        __typename
        icon {
          id
          title
          alt
          url
        }
      }
    }`,
    "allIconBlocks"
  );
  return ids.map((e) => request?.find((r: any) => r.id === e));
};

export const fetchCompanyLogos = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allLogos(locale: ${locale || "en"}, filter: {id: {in: ${JSON.stringify(
      ids
    )}}}) {
        id
        __typename
        logoImg {
          ${imageSchema}
        }
      }
    }`,
    "allLogos"
  );

  return ids.map((e) => request?.find((r: any) => r.id === e)).filter((e) => e);
};

export const fetchIntegrations = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allIntegrations(locale: ${
        locale || "en"
      }, filter: {id: {in: ${JSON.stringify(ids)}}}) {
        id
        __typename
        logo {
          ${imageSchema}
        }
      }
    }`,
    "allIntegrations"
  );

  return ids.map((e) => request?.find((r: any) => r.id === e)).filter((e) => e);
};

export const fetchQuoteTags = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allQuoteTags(locale: ${
        locale || "en"
      }, filter: {id: {in: ${JSON.stringify(ids)}}}) {
        id
        __typename
        text
      }
    }`,
    "allQuoteTags"
  );

  return ids.map((e) => request?.find((r: any) => r.id === e)).filter((e) => e);
};

export const fetchTalkType = async (ids: [string], locale: string) => {
  const request = await fetchRequest(
    `query {
      allAgendaTalkTypes(locale: ${
        locale || "en"
      }, filter: {id: {in: ${JSON.stringify(ids)}}}) {
        id
        __typename
        label
      }
    }`,
    "allAgendaTalkTypes"
  );

  return ids.map((e) => request?.find((r: any) => r.id === e)).filter((e) => e);
};

export const fetchCompanyPerson = async (id: string, locale: string) => {
  const request = await fetchRequest(
    `query {
      allCompanyPeople(locale: ${
        locale || "en"
      }, filter: {id: {eq: ${JSON.stringify(id)}}}) {
        id
        __typename
        companyLogo {
          companyName
          logoLink
          logoImg {
            ${imageSchema}
          }
        }
        image {
          ${imageSchema}
        }
        market {
          market
        }
        role
      }
    }`,
    "allCompanyPeople"
  );

  return request?.[0];
};
