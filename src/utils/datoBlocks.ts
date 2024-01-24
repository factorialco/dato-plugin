import { flatMap } from "lodash-es";
import { rgba2Hex } from "./datoUtils";
import {
  fetchBadgeRecord,
  fetchCertificatesRecord,
  fetchCompanyLogos,
  fetchCompanyPerson,
  fetchCompetitorCard,
  fetchIconBlock,
  fetchIntegrations,
  fetchMedia,
  fetchQuoteTags,
  fetchTalkType,
  fetchVideo,
  getTypename,
  snakeToCamelObject,
} from "./graph";

export const getMediaBlock = async (ctx: any, rawItem: any): Promise<any> => {
  if (!rawItem?.relationships) {
    return null;
  }

  const item = snakeToCamelObject(rawItem);

  const typename = getTypename(
    ctx.itemTypes,
    item.relationships.itemType.data.id
  );

  console.info({ typename, item });

  try {
    switch (typename) {
      case "MediaLottieRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            file: await fetchMedia(item.attributes.file.uploadId),
          },
        ];
      case "MediaImageRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            image: await fetchMedia(item.attributes.image.uploadId),
          },
        ];
      case "MediaImageCollectionRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            images: await Promise.all(
              item.attributes.images.map(async (image: any) => {
                console.log(image.attributes.background);
                return {
                  ...image.attributes,
                  background: image.attributes.background && {
                    hex: rgba2Hex(image.attributes.background),
                  },
                  image: await fetchMedia(image.attributes.image.uploadId),
                };
              })
            ),
          },
        ];
      case "MediaYoutubeRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            thumbnail: await fetchMedia(item.attributes.thumbnail.uploadId),
          },
        ];
      case "MediaVideoRecord":
      case "MediaVideoButtonRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            video: await fetchVideo(item.attributes.video.uploadId),
            thumbnail: await fetchMedia(item.attributes.thumbnail.uploadId),
          },
        ];
      case "CardRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            actionLink: [item.attributes.actionLink[0].attributes],
            cardIcon: (
              await fetchIconBlock([item.attributes.cardIcon], ctx.locale)
            )[0],
          },
        ];
      case "BenefitWithIconRecord":
        const iconIsArray = Array.isArray(item.attributes.iconBlock);
        const iconBlock = await fetchIconBlock(
          iconIsArray ? item.attributes.iconBlock : [item.attributes.iconBlock],
          ctx.locale
        );

        return [
          {
            ...item.attributes,
            __typename: typename,
            link: item.attributes.link[0]
              ? [item.attributes.link[0].attributes]
              : null,
            iconBlock: iconIsArray ? iconBlock : iconBlock[0],
          },
        ];
      case "HeaderMediaChecklistActionRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            action: [item.attributes.action[0].attributes],
            check: item.attributes.check.map((e: any) => e.attributes),
            image: await fetchMedia(item.attributes.image.uploadId),
          },
        ];
      case "HeaderMediaBenefitsIconActionRecord":
        return [
          {
            ...item.attributes,
            __typename: typename,
            action: [item.attributes.action[0].attributes],
            benefitWithIcon: await Promise.all(
              item.attributes.benefitWithIcon.map((e: any) =>
                getMediaBlock(ctx, e)
              )
            ).then((e) => flatMap(e)),
            image: await fetchMedia(item.attributes.image.uploadId),
          },
        ];
      case "RatingBlockRecord":
        return {
          ...item.attributes,
          __typename: typename,
          image: await fetchMedia(item.attributes.image.uploadId),
          logo: await fetchCompanyLogos(item.attributes.logo, ctx.locale),
        };
      case "CarouselColumnRecord":
        return {
          ...item.attributes,
          __typename: typename,
          complementaryImage: await fetchMedia(
            item.attributes.complementaryImage?.uploadId
          ),
          companyPerson: await fetchCompanyPerson(
            item.attributes.companyPerson,
            ctx.locale
          ),
        };
      case "AgendaSlotBlockRecord":
        return {
          ...item.attributes,
          __typename: typename,
          test: 1,
          talkType: await fetchTalkType(item.attributes.talkType, ctx.locale),
        };
      case "ChecklistBlockRecord":
        return {
          ...item.attributes,
          __typename: typename,
          checklist: item.attributes.checklist.map((e: any) => e.attributes),
          action: [item.attributes.action[0].attributes],
        };
      default:
        return [
          {
            ...snakeToCamelObject(item.attributes),
            __typename: typename,
          },
        ];
    }
  } catch (e) {
    console.error(`Media not working: ${typename}`, e);
    return [];
  }
};

export const requestBlock = async (type: string, entry: any, ctx: any) => {
  console.info({ requestBlock: type });
  try {
    switch (type) {
      case "media":
        return getMediaBlock(ctx, entry[0]);
      case "image":
      case "personImage":
        return fetchMedia(entry.uploadId);
      case "certificatesList":
        return fetchCertificatesRecord(entry, ctx.locale);
      case "table":
        try {
          return JSON.parse(entry);
        } catch (e) {
          return null;
        }
      case "badge":
        return fetchBadgeRecord(entry, ctx.locale);
      case "cards":
        return fetchCompetitorCard(entry, ctx.locale);
      case "benefit":
        return Promise.all(
          entry.map(async (e: any) => ({
            ...e.attributes,
            iconBlock:
              e.attributes.iconBlock &&
              (await fetchIconBlock(e.attributes.iconBlock, ctx.locale)),
          }))
        );
      case "quote":
        if (!Array.isArray(entry)) {
          return entry;
        }
        return Promise.all(
          entry.map(async (e: any) => ({
            ...e.attributes,
            logo:
              e.attributes.logo &&
              (await fetchCompanyLogos(e.attributes.logo, ctx.locale)),
            quoteTags:
              e.attributes.quoteTags &&
              (await fetchQuoteTags(e.attributes.quoteTags, ctx.locale)),
            image:
              e.attributes.image.uploadId &&
              (await fetchMedia(e.attributes.image.uploadId)),
          }))
        );
      case "logo":
        return fetchCompanyLogos(entry, ctx.locale);
      case "companyLogo":
        if (!entry) {
          return null;
        }

        if (typeof entry === "string") {
          return (await fetchCompanyLogos([entry], ctx.locale))[0];
        } else if (entry[ctx.locale]) {
          return (await fetchCompanyLogos([entry[ctx.locale]], ctx.locale))[0];
        } else {
          return null;
        }
      case "content":
        if (!entry) {
          return null;
        }
        return Promise.all([
          fetchCompanyLogos(entry, ctx.locale),
          fetchIntegrations(entry, ctx.locale),
        ]).then((res) => [...res[0], ...res[1]]);
      case "companyInfo":
        return Promise.all(
          entry.map(async (e: any) => ({
            ...e.attributes,
            logo:
              e.attributes.logo &&
              (await fetchMedia(e.attributes.logo.uploadId)),
          }))
        );
      case "ratingBlock":
      case "columns":
        return Promise.all(entry.map((e: any) => getMediaBlock(ctx, e)));
      default:
        if (typeof entry === "string" || typeof entry === "boolean") {
          return entry;
        }
        const info = entry.map(async (e: any) => {
          const typename = getTypename(
            ctx.itemTypes,
            e.relationships.itemType.data.id
          );

          const media = await getMediaBlock(ctx, e);

          return {
            ...e.attributes,
            ...(media?.[0] ? media?.[0] : media),
            __typename: typename,
          };
        });

        return Promise.all(info);
    }
  } catch (e) {
    console.error(`Block not working: ${type}`, e);
    return [];
  }
};

export const getCustomBlock = async (ctx: any, items: any) => {
  if (!items || items.length === 0) {
    return [];
  }

  const blocks = [] as any;

  for (const item of items) {
    if (!item.relationships) {
      return null;
    }
    const block = {
      id: item.id,
      __typename: getTypename(
        ctx.itemTypes,
        item.relationships.itemType.data.id
      ),
    } as any;

    for (const [type, value] of Object.entries(
      snakeToCamelObject(item.attributes)
    )) {
      block[type] = await requestBlock(type, value, ctx);
    }

    blocks.push(block);
  }

  return blocks;
};
