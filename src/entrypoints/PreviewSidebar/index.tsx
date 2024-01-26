import { RenderItemFormSidebarCtx } from "datocms-plugin-sdk";
import { useRef, useState } from "react";
import { Button, Canvas } from "datocms-react-ui";

const PreviewSidebar = ({
  ctx,
}: {
  ctx: RenderItemFormSidebarCtx & { itemValue: any };
}) => {
  const itemId = ctx.item?.relationships.item_type.data.id as string;
  const typename = ctx.itemTypes?.[itemId]?.attributes.api_key.replace(
    /(?:^|_)(.)/g,
    (_, group1) => group1.toUpperCase()
  );

  const [zoom, setZoom] = useState<number>(
    parseInt(localStorage.getItem("live-zoom") || "180")
  );
  const iframe = useRef<HTMLIFrameElement>(null);

  const onChangeZoom = (increase: number) => {
    const amount = zoom - increase;

    localStorage.setItem("live-zoom", amount.toString());
    setZoom(amount);
  };

  const getUrl = () => {
    const queryParams = new URLSearchParams({
      id: ctx.item?.id as string,
      lang: ctx.locale.replace("-", "_"),
    }).toString();

    return `https://factorialhr.com/cms/preview/${typename}?${queryParams}`;
  };

  return (
    <Canvas ctx={ctx} noAutoResizer>
      <div style={{ height: window.innerHeight, overflow: "hidden" }}>
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
              key={e}
              buttonSize="xxs"
              onClick={() => onChangeZoom(parseInt(`${e}50`))}
            >
              {e}
            </Button>
          ))}
          <Button
            buttonSize="xxs"
            onClick={() => {
              if (iframe.current) {
                iframe.current.src = iframe.current.src;
              }
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
          src={getUrl()}
          ref={iframe}
        />
      </div>
    </Canvas>
  );
};

export default PreviewSidebar;
