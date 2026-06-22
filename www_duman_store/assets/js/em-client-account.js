document.addEventListener("DOMContentLoaded", function() {
    class FormContacts {
        constructor() {
            this.$form = $("#em-contact");
            this.$message = this.$form.find("[data-em-message]:first");
            this.loader = null;

            this.isChange = false;
            this.dimensionIds = {
                height: 16728780,
                chest:  16728777,
                waist:  16728778,
                hips:   16728779
            };
        }

        async init() {
            if (!this.$form.length) return;

            this.loader = new EM_Module.Loader(this.$form);
            this.loader.call();
            
            this.$form.removeAttr("hidden");

            const client = await ajaxAPI.shop.client.get();
            this.client = client;

            this.$form.removeAttr("hidden");

            this.$form.find(".contact__button:first").on("click", this.submit.bind(this));
            this.$message.on("click", this.closeForm.bind(this));
            this.$form.on("change", this.onChange.bind(this));

            const birthday = client.fields_values.find(field => field.handle == "birthday_date")?.value;

            if (birthday && birthday.length === 10) {
                this.$form.find("[name='birthdate']").val(birthday);
                this.isNewBirthday = false;
            }
            else {
                this.$form.find(".birthdate-disabled").removeClass("birthdate-disabled");
                this.isNewBirthday = true;
            }
            if (client?.id) {
                this.$form.find("input[name='name']").val(client.name ?? "");
                this.$form.find("input[name='surname']").val(client.surname ?? "");
                this.$form.find("input[name='email']").val(client.email ?? "");
                this.$form.find("input[name='phone']").val(client.phone ?? "").get(0)?.dispatchEvent(new Event("input"));

                if (client.subscribe) {
                    this.$form.find("input[name='subscribe']:first").prop("checked", true);
                }
                if (client.messenger_subscription) {
                    this.$form.find("input[name='messenger_subscription']:first").prop("checked", true);
                }

                for (const field of client.fields_values) {
                    if (field.field_id != 16729835) {
                        const $dimension = this.$form.find(`input[name="dimension[${field.field_id}]"]:first`);
                        if ($dimension.length && field.value) {
                            $dimension.val(field.value);
                        }
                        continue;
                    }

                    if (!field.value) continue;
                    const [day, month, year] = field.value.split(".");
                    if (day && month && year) {
                        this.$form.find("input[name='birthdate']:first").val(`${year}-${month}-${day}`);
                    }
                }
                this.$form.find(".contact__button:first").removeAttr("disabled");
                // this.$form.find("input[name='phone']").val(client.phone ?? "").get(0)?.dispatchEvent(new Event("input"));
            }
            this.loader.hide();
        }

        onChange(e) {
            if (e.target.nodeName === "INPUT" && !this.isChange) {
                this.isChange = true;
            }
        }

        getBirthdate(birthdate) {
            if (!birthdate) return"";

            const [year, month, day] = birthdate.split("-");
            return day && month && year ? `${day}.${month}.${year}` : "";
        }

        checkDimensions(dimensions) {
            for (const key in dimensions) {
                const dimension = dimensions[key];
                if (dimension < 1 || dimension > 1000) {
                    return `dimension[${this.dimensionIds[key] ?? 0}]`;
                }
            }
        }

        async submit() {
            if (!this.client?.id) {
                this.showErrors([{
                    text: "Нужно сначала авторизироваться!",
                    type: "all"
                }]);
                return;
            }
            else if (!this.isChange) {
                this.showErrors([{
                    text: "Измените хотя бы одно поле",
                    type: "all"
                }]);
                return;
            }
            this.loader.call();
            let errors = [];
            const 
                name = this.$form.find("input[name='name']").val(),
                surname = this.$form.find("input[name='surname']").val(),
                birthdate = this.getBirthdate( this.$form.find("input[name='birthdate']").val() ),
                phone = this.$form.find("input[name='phone']").val(),
                email = this.$form.find("input[name='email']").val(),
                dimensions = {
                    height: this.$form.find(`input[name='dimension[${this.dimensionIds.height}]']:first`).val(),
                    chest:  this.$form.find(`input[name='dimension[${this.dimensionIds.chest}]']:first`).val(),
                    waist:  this.$form.find(`input[name='dimension[${this.dimensionIds.waist}]']:first`).val(),
                    hips:   this.$form.find(`input[name='dimension[${this.dimensionIds.hips}]']:first`).val()
                },
                subscribe = this.$form.find("input[name='subscribe']").prop('checked'),
                messenger_subscription = this.$form.find("input[name='messenger_subscription']").prop('checked');

            if (!name || name.length < 2) {
                errors.push({
                    text: "Некорректное имя!",
                    type: "name"
                });
            }
            if (!surname || surname.length < 2) {
                errors.push({
                    text: "Некорректная фамилия!",
                    type: "surname"
                });
            }
            if (!birthdate) {
                errors.push({
                    text: "Некорректная дата рождения!",
                    type: "birthdate"
                });
            }
            if (!phone || !EM_Module.phoneMask.validatePhone(phone)) {
                errors.push({
                    text: "Некорректный номер телефона!",
                    type: "phone"
                });
            }
            if (!/^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(email)) {
                errors.push({
                    text: "Некорректный email!",
                    type: "email"
                });
            }
            const errorTypeDimensions = this.checkDimensions(dimensions);
            if (errorTypeDimensions) {
                errors.push({
                    text: "Некорректный размер (не менее 0 и не более 1000)",
                    type: "all"
                });
                errors.push({
                    text: "Некорректное значение",
                    type: errorTypeDimensions
                });
            }
            // if (errors.length == 0 && this.isNewBirthday && e.target.dataset.emSaveBirthdate === undefined) {
            //     this.$form.find("[data-em-contacts-date]").text(birthdate);
            //     this.$form.find("[data-popup='#popup-change-birthdate']:first").trigger("click");
            //     return;
            // }
            if (errors.length > 0) {
                this.showErrors(errors);
                this.loader.hide();
                return;
            }
            this.isChange = false;

            const response = await $.ajax({
                url: "https://insales.widgets.ibice.ru/api/jls-gateway/profile",
                method: 'POST',
                dataType: 'json',
                data: {
                    flow_id: "62b2caa5-7874-40a9-b7f2-1b9561fe9e83",
                    customer: {
                        id: this.client.id,
                        token: this.client.created_at
                    },
                    update: {
                        phone: phone,
                        email: email,
                        name: name, 
                        surname: surname,
                        birthday: birthdate,
                        subscription: subscribe,
                        messenger_subscription: messenger_subscription,
                        dimensions: dimensions
                    }
                },
                timeout: 10000
            });

            this.loader.hide();
            if (!response?.success || response?.errors) {
                console.warn("[Contacts] Ошибка изменения данных:", response?.errors ?? response);
                this.showErrors([{
                    text: response.errors ? response.errors.join("; ") : "непредвиденная ошибка, обратитесь в поддержку",
                    type: "all"
                }]);
            }
            else {
                this.showSuccess();
            }
        }

        saveBirthdate() {
            this.submit();
        }

        closeForm(e) {
            if (!e.currentTarget.classList.contains("account-success-fix")) return;

            this.$message.fadeOut(300);
            this.$message.removeClass("account-errors");
            this.$form.find(".input-error").removeClass("input-error");
        }

        showSuccess() {
            this.$form
                .find(".input-error").removeClass("input-error")
                .find(".contact__input-error").remove();
            this.$message
                .css("display", "flex")
                .attr("hidden", false)
                .addClass("account-success-fix")
                .removeClass("account-errors")
                .find("span:first").text("Изменения сохранены");
            // this.$message.attr("hidden", false)
            //     .addClass("account-success")
            //     .removeClass("account-errors")
            //     .find("span:first").text("Изменения сохранены");
            this.$message.fadeIn(300);

            setTimeout(() => {
                if (this.$message.css("display") !== "none") {
                    this.$message.fadeOut(300);
                }
            }, 4000);
        }

        showErrors(errors) {
            this.$form.find(".input-error").removeClass("input-error");

            let errorTitle = "", scrollToError = false;;
            for (const error of errors) {
                if (error.type == "all" || error.type == "access") {
                    errorTitle += error.text + ", "
                    continue;
                }
                const $parent = this.$form.find(`input[name="${error.type}"]`).closest("div"),
                    $inputError = $parent.find(".contact__input-error");

                if ($inputError.length) {
                    $inputError.text(error.text);
                    $parent.addClass("input-error");
                }
                else if ($parent.length) {
                    $parent.addClass("input-error").append(`<span class="contact__input-error">${error.text}</span>`);
                }
                if (!scrollToError) {
                    scrollToError = true;
                    $("html").animate({
                        scrollTop: $parent.offset().top - 100
                    }, 500);
                }
            }

            if (errorTitle) {
                this.$message.attr("hidden", false)
                    .addClass("account-errors")
                    .removeClass("account-success-fix")
                    .find("span:first").text(
                        errorTitle 
                            ? errorTitle.substring(0, errorTitle.length - 2) 
                            : "ошибка, заполните поля корректно!"
                    );

                if (!scrollToError) {
                    $("html").animate({
                        scrollTop: this.$message.offset().top - 100
                    }, 500);
                }
            }
            else {
                this.$message.attr("hidden", true);
            }
        }
    }

    const path = window.location.pathname;

    $(".login__container:first .account__navigation-title").each(function () {
        if (this.pathname == path) {
            this.classList.add("_active");
            return false;
        }
    });

    if (path.includes("/client_account/contacts")) {
        console.log("[EM] Init form Contacts");
        $(".account__title:first").text("Мои данные");

        EventBus.subscribe('eventLoader', function () {
            (new FormContacts()).init();
        });
    }
    else {
        $("#yield-all").removeAttr("hidden");
    }
});
