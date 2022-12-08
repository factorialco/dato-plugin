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

type Props = {
  ctx: RenderFieldExtensionCtx;
  chargebeeElement: ChargebeeElements;
};

export const ChargbeeSelector = <T extends { name: string }>({
  ctx,
  chargebeeElement,
}: Props) => {
  const [elements, setAddons] = useState<T[]>(() => []);
  const [activeElement, setActiveElement] = useState(() =>
    getValueFromContext(ctx)
  );

  const toggleAddon = (name: string) => () => {
    setActiveElement((activeElement) => (activeElement === name ? "" : name));
    ctx.setFieldValue(
      ctx.fieldPath,
      activeElement === name
        ? null
        : elements.find(({ name: elementName }) => elementName === name)
    );
  };

  useEffect(() => {
    getElements<T>(
      chargebeeElement,
      ctx.plugin.attributes.parameters.authorization as string
    ).then((auxAddons) => setAddons(auxAddons));
  }, [ctx.plugin.attributes.parameters.authorization, chargebeeElement]);

  return (
    <Canvas ctx={ctx}>
      <div style={{ height: "200px" }}>
        <Dropdown
          renderTrigger={({ open, onClick }) => (
            <Button
              disabled={elements.length === 0}
              onClick={onClick}
              rightIcon={open ? <CaretUpIcon /> : <CaretDownIcon />}
            >
              {activeElement || "Select an addon"}
            </Button>
          )}
        >
          <DropdownMenu>
            {elements.map(({ name }) => (
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
    </Canvas>
  );
};
