import {
  getCustomBlock,
  getMediaBlock,
  requestBlock,
} from "../../utils/datoBlocks";
import { getTypename, snakeToCamel } from "../../utils/graph";

export const getSection = async ({
  attributes,
  typename,
  ctx,
}: {
  attributes: any;
  typename: string;
  ctx: any;
}) => {
  const fields = { __typename: typename } as any;

  for (const prop of Object.keys(attributes)) {
    const propName = snakeToCamel(prop);
    console.warn({ getSectionProp: prop, attributes });

    switch (prop) {
      case "media":
        fields[propName] = await getMediaBlock(
          ctx,
          attributes[prop][ctx.locale][0]
        );
        break;
      case "mainAction":
      case "components":
      case "cards":
      case "testimonials":
      case "mediaItems":
      case "agenda":
        fields[propName] = await getCustomBlock(
          ctx,
          attributes[prop][ctx.locale]
        );
        break;
      case "companyLogo":
      case "content":
      case "quote":
      case "benefitWithIcon":
      case "featuresStoryline":
      case "ratingBlock":
      case "logo":
        if (typename === "HeaderTextRecord") {
          fields[propName] = attributes[prop][ctx.locale] ?? attributes[prop];
          break;
        }
        fields[propName] = await requestBlock(
          propName,
          attributes[prop][ctx.locale] ?? attributes[prop],
          ctx
        );
        break;
      case "layoutContent":
        fields[propName] = [
          await getSection({
            attributes: attributes[prop][ctx.locale][0].attributes,
            typename: getTypename(
              ctx.itemTypes,
              attributes[prop][ctx.locale][0].relationships.itemType.data.id
            ),
            ctx,
          }),
        ];
        break;
      default:
        if (Array.isArray(attributes[prop])) {
          fields[propName] = attributes[prop].map((e: any) => e.attributes);
        } else {
          const propContent =
            typeof attributes[prop]?.[ctx.locale] !== "undefined"
              ? attributes[prop]?.[ctx.locale]
              : attributes[prop];

          fields[propName] =
            propContent?.map?.((e: any) => e.attributes) || propContent;
        }

        break;
    }
  }

  // specific cases based on the section typename that overwrites props

  switch (typename) {
    case "CompetitorsBlockRecord":
      fields.cards = await requestBlock(
        "cards",
        attributes.cards[ctx.locale],
        ctx
      );
      break;
  }

  return fields;
};
