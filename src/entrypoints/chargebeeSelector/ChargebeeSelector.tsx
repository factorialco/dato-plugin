import { RenderFieldExtensionCtx } from "datocms-plugin-sdk";
import {
  Button,
  Canvas,
  CaretDownIcon,
  CaretUpIcon,
  Dropdown,
  DropdownMenu,
  DropdownOption,
} from "datocms-react-ui";
import { useEffect, useState } from "react";
import { getValueFromContext } from "./chargbeeSelector.utils";
import { ChargebeeElements, getElements } from "./chagebeeSelector.services";
import { Plan } from "./types";

type Props = {
  ctx: RenderFieldExtensionCtx;
  chargebeeElement: ChargebeeElements;
};

export const ChargbeeSelector = ({ ctx, chargebeeElement }: Props) => {
  const [elements, setAddons] = useState<Plan[]>(() => []);
  const [activeElement, setActiveElement] = useState(() =>
    getValueFromContext(ctx)
  );

  const toggleAddon = (name: string) => () => {
    setActiveElement((activeElement) => (activeElement === name ? "" : name));
    ctx.setFieldValue(
      ctx.fieldPath,
      activeElement === name
        ? null
        : JSON.stringify(
            elements.find(({ name: elementName }) => elementName === name)
          )
    );
  };

  useEffect(() => {
    getElements(
      chargebeeElement,
      ctx.plugin.attributes.parameters.authorization as string
    ).then((auxAddons) => setAddons(auxAddons));
  }, [ctx.plugin.attributes.parameters.authorization, chargebeeElement]);

  return (
    <Canvas ctx={ctx}>
      <div style={{ height: "200px", width: "100%", display: "flex" }}>
        <div style={{ flexGrow: 1 }}>
          <Dropdown
            renderTrigger={({ open, onClick }) => (
              <Button
                style={{ width: "100%" }}
                disabled={elements.length === 0}
                onClick={onClick}
                rightIcon={open ? <CaretUpIcon /> : <CaretDownIcon />}
              >
                {activeElement || "Select from chargebee"}
              </Button>
            )}
          >
            <DropdownMenu>
              {elements
                .sort((a, b) => (a.name > b.name ? 1 : -1))
                .map(({ name }) => (
                  <DropdownOption
                    key={name}
                    active={name === activeElement}
                    closeMenuOnClick
                    onClick={toggleAddon(name)}
                  >
                    {name}
                  </DropdownOption>
                ))}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    </Canvas>
  );
};
