import { RenderItemFormSidebarCtx } from "datocms-plugin-sdk";
import { useEffect, useRef, useState } from "react";
import { getTypename, snakeToCamelObject } from "../../utils/graph";
import { getSection } from "./sectionPrepare";
import s from "../styles.module.css";
import { Button, ButtonGroup, Canvas, Spinner } from "datocms-react-ui";

export const NOT_SUPORTED_COMPONENTS: string[] = [
  "CardsBlockRecord",
  "HeroRecord",
  "BenefitCardRecord",
  "BenefitGridRecord",
  "FeatureRecord",
  "LeadGeneratorRecord",
  "BannerRecord",
  "AbtestRecord",
  "HomepageRecord",
  "PageRecord",
  "ResourceRecord",
];

const PreviewSidebar = ({
  ctx,
}: {
  ctx: RenderItemFormSidebarCtx & { itemValue: any };
}) => {
  const [zoom, setZoom] = useState<number>(
    parseInt(localStorage.getItem("live-zoom") || "180")
  );
  const [isNotSupported, setIsNotSupported] = useState(false);
  const [iframeUrl, setIframeUrl] = useState("https://factorialhr.com/cms/datocms");
  const iframe = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshIframe = () => {
    ctx
      .formValuesToItem(ctx.itemValue)
      .then(async ({ attributes, relationships }: any) => {
        if (iframe.current) {
          console.clear();
          const typename = getTypename(
            ctx.itemTypes,
            relationships.item_type.data.id
          );

          if (NOT_SUPORTED_COMPONENTS.includes(typename)) {
            setIsNotSupported(true);
          } else {
            setIsNotSupported(false);
          }
          const message = {
            sections: [
              await getSection({
                attributes: snakeToCamelObject(attributes),
                typename,
                ctx,
              }),
            ],
          };

          console.log(message.sections[0]);

          iframe.current.contentWindow?.postMessage(message, "*");
        }
      });
  };

  const onChangeZoom = (increase: number) => {
    const amount = zoom - increase;

    localStorage.setItem("live-zoom", amount.toString());
    setZoom(amount);
  };

  useEffect(() => {
    refreshIframe();
  }, [iframe, ctx]);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (event.data.status === "ready") {
        setIsLoading(false);
        refreshIframe();
      }
    });
  }, []);

  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div style={{ height: window.innerHeight }}>
        {isLoading && <Spinner size={48} placement="centered" />}
        {!isLoading && isNotSupported && (
          <div className={s.livePreviewLoading}>
            <span>
              Component no longer supported. <br /> Preview may be broken
            </span>
          </div>
        )}
        <div
          style={{
            padding: 10,
            justifyContent: "flex-end",
            display: "flex",
            gap: "10px",
          }}
        >
          {["-", "+"].map((e) => (
            <Button
              buttonSize="xxs"
              onClick={() => onChangeZoom(parseInt(`${e}50`))}
            >
              {e}
            </Button>
          ))}
          <Button
            buttonSize="xxs"
            onClick={() => {
              setIframeUrl(`${iframeUrl}?t=${+new Date()}`);
              setIsLoading(true);
            }}
          >
            Force reload
          </Button>
        </div>
        <iframe
          width={`${zoom}%`}
          height={`${zoom}%`}
          style={{
            border: 0,
            transform: `scale(${100 / zoom})`,
            transformOrigin: "top left",
          }}
          src={iframeUrl}
          ref={iframe}
        />
      </div>
    </Canvas>
  );
};

export default PreviewSidebar;
