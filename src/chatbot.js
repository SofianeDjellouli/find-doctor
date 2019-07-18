import React from "react";
import axios from "axios";
import Header from "header/src/header-for-react";
import { Async } from "react-select";
import client from "@google/maps";
import { Map, Marker, GoogleApiWrapper } from "google-maps-react";
import PropTypes from "prop-types";
import { withStyles } from "@material-ui/core/styles";
import { Chip, Tooltip, Zoom, Slide, Paper, Grid } from "@material-ui/core";
import { Close, Place } from "@material-ui/icons";
import medImg from "./img/card1_topart-02.png";
import capsuleImg from "./img/capsule_orange1.png";
import "react-select/dist/react-select.css";
import "./chatbotStyle.css";

const { NODE_ENV, REACT_APP_API, REACT_APP_API_KEY } = process.env,
  API = NODE_ENV === "development" ? REACT_APP_API : window.API_URL;

const styles = theme => ({
  root: {
    margin: "8px 2px",
    width: "calc(33.33% - 4px)",
    backgroundImage: `url(${capsuleImg})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "100% 100%",
    backgroundColor: "transparent",
    fontFamily: "Open Sans Regular",
    fontSize: 18,
    color: "#f2f2f2",
    boxShadow: "grey 0px 26px 75px -8px",
    zIndex: 1,
    justifyContent: "space-between",
    height: window.innerWidth > 1500 ? 60 : null,
    borderRadius: window.innerWidth > 1500 ? 30 : null
  },
  label: {
    textOverflow: "ellipsis",
    overflow: "hidden",
    whiteSpace: "nowrap",
    display: "block"
  },
  deleteIcon: { width: window.innerWidth > 1500 ? "1em" : "0.5em" }
});

const handleError = errorObject => {
  console.error(errorObject);
  var errorMessage, code;
  if (errorObject) {
    try {
      var {
        response: {
          data: { error, Error },
          status
        }
      } = errorObject;
      errorMessage = error || Error;
      code = status;
    } catch (e) {}
  }

  if (
    window.confirm(
      errorMessage && typeof errorMessage === "string"
        ? errorMessage
        : "An error occured. Please try again.\nOften, clearing your browser's cache and restarting your browser will solve this problem.\nIf that doesn't work, please contact us."
    ) &&
    code &&
    code >= 500
  )
    window.location.reload();
};

class ChatBot extends React.Component {
  state = {
    symptom: [],
    condition: [],
    isFocused: false,
    address: "",
    specialties: [],
    openDetails: false,
    detailsBackgroundColor: "",
    conditionFocused: {},
    location: {},
    checkSymptoms: true,
    checkConditions: false,
    checkSpecializations: false,
    pastChecked: ""
  };

  componentDidMount() {
    const { user_type, user_token } = localStorage;
    if ((user_type === "1" || user_type === "6") && user_token)
      axios
        .get(`${API}${user_type === "1" ? "doctor" : "patient"}`, {
          headers: { authorization: user_token }
        })
        .catch(handleError)
        .then(({ data }) => {
          const { latitude, longitude, addressLine1 } = data;
          if (latitude && longitude)
            this.setState({
              location: { lat: latitude, lng: longitude }
            });
          else if (addressLine1)
            client
              .createClient({ key: REACT_APP_API_KEY, Promise })
              .geocode({ address: addressLine1 })
              .asPromise()
              .then(({ json }) => this.setState({ location: json.results[0].geometry.location }))
              .catch(this.setCurrentPosition);
          else this.setCurrentPosition();
        })
        .catch(handleError);
    else this.setCurrentPosition();
  }

  setCurrentPosition = () =>
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude, longitude } }) =>
        this.setState({ location: { lat: latitude, lng: longitude } }),
      ({ code }) => {
        if (code) this.setState({ noMap: true });
      }
    );

  loadOptions = (input, endpoint) => {
    if (input.length < 3) return Promise.resolve();
    else
      return axios
        .get(API + "search/" + endpoint + "?q=" + input.toLowerCase())
        .then(({ data }) => ({ options: data }))
        .catch(handleError);
  };

  handleSymptoms = value =>
    this.setState(
      {
        symptom: value,
        checkConditions: true,
        checkSymptoms: false,
        openDetails: false,
        specialties: []
      },
      this.getSymptoms
    );

  getSymptoms = () =>
    axios
      .get(
        API +
          "search/triage?symptoms=" +
          this.state.symptom.map(({ symptom_id }) => symptom_id).join(",")
      )
      .then(({ data }) => this.setState({ condition: data.slice(0, 5) }))
      .catch(handleError);

  handleRemove = index => {
    let { symptom } = this.state;
    symptom.splice(index, 1);
    this.setState({ symptom }, () => {
      if (!symptom.length)
        this.setState({
          condition: [],
          checkConditions: false,
          checkSpecializations: false,
          checkSymptoms: true,
          openDetails: false,
          specialties: []
        });
      else this.getSymptoms();
    });
  };

  handleFocus = () => {
    const { checkSpecializations, checkConditions } = this.state;
    this.setState({
      isFocused: true,
      checkConditions: false,
      checkSymptoms: true,
      checkSpecializations: false,
      pastChecked: checkSpecializations
        ? "checkSpecializations"
        : checkConditions
        ? "checkConditions"
        : "checkSymptoms"
    });
  };

  handleBlur = () => {
    const { pastChecked, specialties } = this.state;
    this.setState({
      isFocused: false,
      checkConditions: pastChecked === "checkConditions",
      checkSymptoms: pastChecked === "checkSymptoms",
      checkSpecializations: pastChecked === "checkSpecializations" && specialties.length
    });
  };

  closeDetails = () =>
    this.setState({
      openDetails: false,
      specialties: [],
      checkConditions: true,
      checkSpecializations: false,
      checkSymptoms: false
    });

  conditionFocus = (detailsBackgroundColor, conditionFocused) => {
    this.setState({
      checkConditions: false,
      checkSpecializations: true,
      openDetails: true,
      detailsBackgroundColor,
      conditionFocused
    });
    axios
      .get(API + "search/triage_specialty?conditions=" + conditionFocused.condition_id, {
        headers: {
          authorization: localStorage.user_token
        }
      })
      .then(({ data }) => {
        this.setState({
          specialties: data.slice(0, 3).some(({ name }) => name === "Primary Care Physician")
            ? [
                ...data.slice(0, 3).filter(e => e.name !== "Primary Care Physician"),
                ...data.slice(0, 3).filter(e => e.name === "Primary Care Physician")
              ]
            : [
                ...data.slice(0, 2),
                {
                  description: "first contact for an undiagnosed medical condition",
                  keywords:
                    "adult and pediatric medicine, preventive care, wellness, prevention, primary health",
                  name: "Primary Care Physician"
                }
              ]
        });
      })
      .catch(handleError);
  };

  oneConditionGrid = () => {
    return (
      <Grid container>
        <Grid item xs={12}>
          <Paper
            style={{
              backgroundColor: "#3b305B",
              height: "calc(100vh - 177px)"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#3b305B", this.state.condition[0])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[0].name}
            </div>
            <div className="click-to-expand">
              <span>CLICK TO EXPAND</span>
            </div>
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[0].sub_symptoms.length > 360
                  ? this.state.condition[0].sub_symptoms.slice(0, 360) + "..."
                  : this.state.condition[0].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  twoConditionsGrid = () => {
    return (
      <Grid container>
        <Grid item xs={12}>
          <Paper
            style={{
              backgroundColor: "#3b305B"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#3b305B", this.state.condition[0])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[0].name}
            </div>
            <div className="click-to-expand">
              <span>CLICK TO EXPAND</span>
            </div>
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[0].sub_symptoms.length > 360
                  ? this.state.condition[0].sub_symptoms.slice(0, 360) + "..."
                  : this.state.condition[0].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper
            style={{
              backgroundColor: "#7b335a"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#7b335a", this.state.condition[1])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[1].name}
            </div>
            <hr />
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[1].sub_symptoms.length > 150
                  ? this.state.condition[1].sub_symptoms.slice(0, 150) + "..."
                  : this.state.condition[1].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  threeConditionsGrid = () => {
    return (
      <Grid container>
        <Grid item xs={12}>
          <Paper
            style={{
              backgroundColor: "#3b305B"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#3b305B", this.state.condition[0])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[0].name}
            </div>
            <div className="click-to-expand">
              <span>CLICK TO EXPAND</span>
            </div>
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[0].sub_symptoms.length > 360
                  ? this.state.condition[0].sub_symptoms.slice(0, 360) + "..."
                  : this.state.condition[0].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper
            style={{
              backgroundColor: "#7b335a"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#7b335a", this.state.condition[1])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[1].name}
            </div>
            <hr />
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[1].sub_symptoms.length > 150
                  ? this.state.condition[1].sub_symptoms.slice(0, 150) + "..."
                  : this.state.condition[1].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper
            style={{
              backgroundColor: "#ef4f5e"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#ef4f5e", this.state.condition[2])}>
            <div className="conditions-grid-text condition-name" style={{ color: "#3b305b" }}>
              {this.state.condition[2].name}
            </div>
            <hr style={{ borderColor: "#3b305b" }} />
            <div
              className="conditions-grid-text condition-subsymptoms"
              style={{ color: "#3b305b" }}>
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[2].sub_symptoms.length > 150
                  ? this.state.condition[2].sub_symptoms.slice(0, 150) + "..."
                  : this.state.condition[2].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  fourConditionsGrid = () => {
    return (
      <Grid container>
        <Grid item xs={12} className="grid-item">
          <Paper
            style={{
              backgroundColor: "#3b305B"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#3b305B", this.state.condition[0])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[0].name}
            </div>
            <div className="click-to-expand">
              <span>CLICK TO EXPAND</span>
            </div>
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[0].sub_symptoms.length > 360
                  ? this.state.condition[0].sub_symptoms.slice(0, 360) + "..."
                  : this.state.condition[0].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={6} className="grid-item">
          <Paper
            style={{
              backgroundColor: "#7b335a"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#7b335a", this.state.condition[1])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[1].name}
            </div>
            <hr />
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[1].sub_symptoms.length > 150
                  ? this.state.condition[1].sub_symptoms.slice(0, 150) + "..."
                  : this.state.condition[1].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid style={{ flexDirection: "column", justifyContent: "center" }} item xs={6}>
          <Grid item xs={12} className="grid-item">
            <Paper
              style={{
                backgroundColor: "#ef4f5e",
                height: "calc((100vh - 165.5px) / 4)"
              }}
              className="grid-item-wrapper"
              onClick={e => this.conditionFocus("#ef4f5e", this.state.condition[2])}>
              <div className="conditions-grid-text condition-name" style={{ color: "#3b305b" }}>
                {this.state.condition[2].name}
              </div>
              <hr style={{ borderColor: "#3b305b" }} />
            </Paper>
          </Grid>
          <Grid item xs={12} className="grid-item">
            <Paper
              style={{
                backgroundColor: "#629896",
                height: "calc((100vh - 165.5px) / 4)"
              }}
              className="grid-item-wrapper"
              onClick={e => this.conditionFocus("#629896", this.state.condition[3])}>
              <div className="conditions-grid-text condition-name" style={{ color: "#7b335a" }}>
                {this.state.condition[3].name}
              </div>
              <hr style={{ borderColor: "#7b335a" }} />
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    );
  };

  fiveConditionsGrid = () => {
    return (
      <Grid container>
        <Grid item xs={12}>
          <Paper
            style={{
              backgroundColor: "#3b305B"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#3b305B", this.state.condition[0])}>
            <div className="conditions-grid-text condition-name">
              {this.state.condition[0].name}
            </div>
            <div className="click-to-expand">
              <span>CLICK TO EXPAND</span>
            </div>
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[0].sub_symptoms.length > 360
                  ? this.state.condition[0].sub_symptoms.slice(0, 360) + "..."
                  : this.state.condition[0].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper
            style={{
              backgroundColor: "#7b335a"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#7b335a", this.state.condition[1])}>
            <div className="conditions-grid-text condition-name" style={{ fontSize: 23 }}>
              {this.state.condition[1].name}
            </div>
            <hr />
            <div className="conditions-grid-text condition-subsymptoms">
              <div className="title">DETAILS:</div>
              <div>
                {" "}
                {this.state.condition[1].sub_symptoms.length > 150
                  ? this.state.condition[1].sub_symptoms.slice(0, 150) + "..."
                  : this.state.condition[1].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper
            style={{
              backgroundColor: "#ef4f5e",
              color: "#3b305b"
            }}
            className="grid-item-wrapper"
            onClick={e => this.conditionFocus("#ef4f5e", this.state.condition[2])}>
            <div
              className="conditions-grid-text condition-name"
              style={{ color: "#3b305b", fontSize: 18 }}>
              {this.state.condition[2].name}
            </div>
            <hr style={{ borderColor: "#3b305b" }} />
            <div
              className="conditions-grid-text condition-subsymptoms"
              style={{ color: "#3b305b" }}>
              <div className="title">DETAILS:</div>
              <div>
                {this.state.condition[2].sub_symptoms.length > 53
                  ? this.state.condition[2].sub_symptoms.slice(0, 53) + "..."
                  : this.state.condition[2].sub_symptoms}
              </div>
            </div>
          </Paper>
        </Grid>
        <Grid style={{ flexDirection: "column", justifyContent: "center" }} item xs={3}>
          <Grid item xs={12}>
            <Paper
              style={{
                backgroundColor: "#629896",
                height: "calc((100vh - 165.5px) / 4)"
              }}
              className="grid-item-wrapper"
              onClick={e => this.conditionFocus("#629896", this.state.condition[3])}>
              <div
                className="conditions-grid-text condition-name"
                style={{ color: "#7b335a", fontSize: 15 }}>
                {this.state.condition[3].name}
              </div>
              <hr style={{ borderColor: "#7b335a" }} />
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper
              style={{
                backgroundColor: "#fecd5f",
                height: "calc((100vh - 165.5px) / 4)"
              }}
              className="grid-item-wrapper"
              onClick={e => this.conditionFocus("#fecd5f", this.state.condition[4])}>
              <div
                className="conditions-grid-text condition-name"
                style={{ color: "#3b305b", fontSize: 14 }}>
                {this.state.condition[4].name}
              </div>
              <hr style={{ borderColor: "#3b305b" }} />
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    );
  };

  colorSetter = () => {
    const { detailsBackgroundColor } = this.state;
    return detailsBackgroundColor === "#ef4f5e"
      ? "#3b305b"
      : detailsBackgroundColor === "#629896"
      ? "#7b335a"
      : detailsBackgroundColor === "#fecd5f"
      ? "#3b305b"
      : null;
  };

  render() {
    const { classes, google } = this.props,
      {
        checkSymptoms,
        noMap,
        checkConditions,
        checkSpecializations,
        specialties,
        location,
        symptom,
        openDetails,
        detailsBackgroundColor,
        isFocused,
        condition
      } = this.state,
      { lat, lng } = location,
      {
        name,
        sub_symptoms,
        treatment,
        workup,
        medical_tests,
        videos
      } = this.state.conditionFocused;
    return (
      <div>
        {Header()}
        <main>
          <div id="tabs" onClick={e => e.preventDefault()}>
            <div>
              <input type="radio" name="tabs" id="symptomsTab" checked={checkSymptoms} readOnly />
              <label htmlFor="symptomsTab">SYMPTOMS</label>
              <input
                type="radio"
                name="tabs"
                id="conditionsTab"
                checked={checkConditions}
                readOnly
              />
              <label htmlFor="conditionsTab">CONDITIONS</label>
              <input
                type="radio"
                name="tabs"
                id="specializationsTab"
                checked={checkSpecializations}
                readOnly
              />
              <label htmlFor="specializationsTab">SPECIALIZATIONS</label>
              <div id="tabSlider" />
            </div>
          </div>
          <div id="wrapper-div">
            <div className="card" id="symptoms">
              <img src={medImg} alt="Your symptoms" />
              <div
                style={{
                  width: "100%",
                  marginTop: "auto",
                  marginBottom: 4,
                  height: window.innerWidth > 1500 ? 222 : 152
                }}>
                <Async
                  disabled={symptom.length === 6}
                  arrowRenderer={null}
                  searchPromptText="Select from list"
                  filterOptions={options =>
                    options.filter(e => !symptom.map(({ name }) => name).includes(e.name))
                  }
                  wrapperStyle={{
                    width: "80%",
                    margin: "0px auto"
                  }}
                  style={{
                    fontFamily: "Open Sans Regular",
                    color: "#c8c5bc",
                    boxShadow: "grey 0px 26px 75px -8px",
                    height: window.innerWidth > 1500 ? 60 : 46,
                    display: "flex",
                    alignItems: "center",
                    borderRadius: !isFocused ? "100px" : "10px 10px 0 0"
                  }}
                  onFocus={this.handleFocus}
                  onBlur={this.handleBlur}
                  autoBlur
                  onBlurResetsInput={false}
                  placeholder={
                    symptom.length < 6
                      ? "Enter your symptoms here"
                      : "Max number of symptoms entered"
                  }
                  valueKey={"id"}
                  labelKey={"name"}
                  loadOptions={input => this.loadOptions(input, "symptom")}
                  onChange={value => this.handleSymptoms([...symptom, value])}
                  clearable={false}
                />
                {symptom && symptom.length > 0 && (
                  <div
                    style={{
                      width: "80%",
                      margin: "10px auto 0px",
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "spaceBetween"
                    }}>
                    {symptom.map(({ name, id }, i) => (
                      <Tooltip title={name} key={id} TransitionProps={{ style: { fontSize: 12 } }}>
                        <Chip
                          label={name}
                          onDelete={() => this.handleRemove(i)}
                          classes={{
                            root: classes.root,
                            label: classes.label,
                            deleteIcon: classes.deleteIcon
                          }}
                        />
                      </Tooltip>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="card" id="conditions">
              {condition && condition.length > 0 ? (
                <div style={{ margin: "0px 10px" }}>
                  {condition.length === 1
                    ? this.oneConditionGrid()
                    : condition.length === 2
                    ? this.twoConditionsGrid()
                    : condition.length === 3
                    ? this.threeConditionsGrid()
                    : condition.length === 4
                    ? this.fourConditionsGrid()
                    : condition.length === 5
                    ? this.fiveConditionsGrid()
                    : null}
                </div>
              ) : (
                <div style={{ margin: "0px 10px" }} className="default-grid-wrapper">
                  <Grid container>
                    <Grid item xs={12}>
                      <Paper
                        style={{
                          backgroundColor: "#3b305B"
                        }}
                        className="grid-item-wrapper"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Paper
                        style={{
                          backgroundColor: "#7b335a"
                        }}
                        className="grid-item-wrapper"
                      />
                    </Grid>
                    <Grid item xs={3}>
                      <Paper
                        style={{
                          backgroundColor: "#ef4f5e",
                          color: "#3b305b"
                        }}
                        className="grid-item-wrapper"
                      />
                    </Grid>
                    <Grid
                      style={{
                        flexDirection: "column",
                        justifyContent: "center"
                      }}
                      item
                      xs={3}>
                      <Grid item xs={12}>
                        <Paper
                          style={{
                            backgroundColor: "#629896",
                            height: "calc((100vh - 165.5px) / 4)"
                          }}
                          className="grid-item-wrapper"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Paper
                          style={{
                            backgroundColor: "#fecd5f",
                            height: "calc((100vh - 165.5px) / 4)"
                          }}
                          className="grid-item-wrapper"
                        />
                      </Grid>
                    </Grid>
                  </Grid>
                </div>
              )}
              {openDetails && (
                <Zoom in={openDetails}>
                  <Paper
                    elevation={4}
                    className="condition-details"
                    style={{ backgroundColor: detailsBackgroundColor }}>
                    <Close
                      className="close-button"
                      onClick={this.closeDetails}
                      style={{ color: this.colorSetter() }}
                    />
                    <div className="condition-details-content-wrapper">
                      <h4 style={{ color: this.colorSetter() }}>{name}</h4>
                      <hr style={{ borderColor: this.colorSetter() }} />
                      <div
                        className="condition-details-content"
                        style={{ height: window.innerHeight - 266 }}>
                        {sub_symptoms && (
                          <div>
                            <h5 style={{ color: this.colorSetter() }}>Sub Symptoms</h5>
                            <div style={{ color: this.colorSetter() }}>{sub_symptoms}</div>
                          </div>
                        )}
                        {treatment && (
                          <div>
                            <h5 style={{ color: this.colorSetter() }}>Treatment</h5>
                            <div style={{ color: this.colorSetter() }}>{treatment}</div>
                          </div>
                        )}
                        {workup && (
                          <div>
                            <h5 style={{ color: this.colorSetter() }}>Workup</h5>
                            <div style={{ color: this.colorSetter() }}>{workup}</div>
                          </div>
                        )}
                        {medical_tests && (
                          <div>
                            <h5 style={{ color: this.colorSetter() }}>Tests</h5>
                            <div style={{ color: this.colorSetter() }}>{medical_tests}</div>
                          </div>
                        )}
                        {videos && videos.length > 0 && (
                          <div>
                            <h5 style={{ color: this.colorSetter() }}>Videos</h5>
                            <div style={{ color: this.colorSetter() }}>
                              <ul>
                                {videos.map(({ player_links, title }, i) => (
                                  <li key={i}>
                                    <a
                                      style={{ color: this.colorSetter() }}
                                      href={player_links}
                                      target="_blank"
                                      rel="noopener noreferrer">
                                      {title}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                      <hr style={{ borderColor: this.colorSetter() }} />
                    </div>
                  </Paper>
                </Zoom>
              )}
            </div>
            <div className="card" id="specialties">
              {lat && lng ? (
                <Map
                  google={google}
                  zoom={14}
                  disableDefaultUI={true}
                  initialCenter={location}
                  style={{
                    height: document.querySelector(".card").clientHeight - 13,
                    borderRadius: 4,
                    boxShadow:
                      "0px 1px 5px 0px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 3px 1px -2px rgba(0, 0, 0, 0.12)"
                  }}>
                  <Marker />
                </Map>
              ) : (
                <div style={{ margin: "auto" }}>
                  {noMap &&
                    !specialties.length &&
                    "Sorry, we haven't been able to track your location."}
                </div>
              )}
              {specialties && specialties.length > 0 && (
                <Slide in={specialties.length > 0} direction="right" timeout={300}>
                  <div className="specialty-list">
                    {specialties.map(({ name, description, ID }, i) => (
                      <div
                        key={ID}
                        className="specialty-wrapper-balloon"
                        onClick={() =>
                          lat && lng
                            ? window.open(
                                `${window.location.origin}/search.php?q=${encodeURIComponent(
                                  name
                                )}&lat=${lat}&lng=${lng}`
                              )
                            : window.alert("Sorry, we haven't been able to track your location.")
                        }>
                        <Place className="balloon" />
                        <div
                          className="specialty-wrapper"
                          style={{
                            backgroundColor:
                              i === 0
                                ? "#7b335a"
                                : i === 1
                                ? "#ef4f5e"
                                : i === 2
                                ? "#629896"
                                : "#7b335a"
                          }}>
                          <div className="specialty-name">
                            {name.length > 35
                              ? name.slice(0, 35).toUpperCase() + "..."
                              : name.toUpperCase()}
                          </div>
                          <div className="specialty-description">{description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Slide>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }
}

ChatBot.propTypes = {
  classes: PropTypes.object.isRequired
};

export default GoogleApiWrapper({ apiKey: REACT_APP_API_KEY })(withStyles(styles)(ChatBot));
